import assert from "node:assert/strict";
import test from "node:test";
import { filterScopedModels, registerFixedDefaults } from "../extensions/fixed-defaults.ts";

const config = { provider: "CLI", model: "grok-4.5", thinking: "high" } as const;
const store = { read: async () => config, write: async () => {} };

const scopedModels = [
	{ model: { provider: "CLI", id: "grok-4.5", name: "Grok 4.5" } },
	{ model: { provider: "CLI", id: "gpt-5.6-sol", name: "GPT 5.6 Sol" } },
] as any;

const pagedScopedModels = [
	...scopedModels,
	...Array.from({ length: 10 }, (_, index) => ({
		model: { provider: "CLI", id: `model-${index + 1}`, name: `Model ${index + 1}` },
	})),
] as any;

test("filters only the supplied scoped models", () => {
	assert.deepEqual(
		filterScopedModels(scopedModels, "grok").map((item) => item.model.id),
		["grok-4.5"],
	);
});

test("applies fixed defaults on startup and /new only", async () => {
	let onSessionStart: ((event: { reason: string }, ctx: any) => Promise<void>) | undefined;
	const selected: string[] = [];
	const pi = {
		on(event: string, handler: typeof onSessionStart) {
			assert.equal(event, "session_start");
			onSessionStart = handler;
		},
		registerCommand() {},
		async setModel(model: { provider: string; id: string }) {
			selected.push(`${model.provider}/${model.id}`);
			return true;
		},
		setThinkingLevel(level: string) {
			selected.push(level);
		},
	} as any;
	const ctx = {
		modelRegistry: { find: (provider: string, model: string) => ({ provider, id: model }) },
		ui: { notify() {} },
	};

	registerFixedDefaults(pi, store);
	assert.ok(onSessionStart);

	for (const reason of ["startup", "new", "resume", "fork", "reload"]) {
		await onSessionStart({ reason }, ctx);
	}

	assert.deepEqual(selected, ["CLI/grok-4.5", "high", "CLI/grok-4.5", "high"]);
});

test("/defaults shows a searchable paginated scoped list and only saves future defaults", async () => {
	let command: { handler: (args: string, ctx: any) => Promise<void> } | undefined;
	let saved: unknown;
	let initialRender: string[] = [];
	let secondPageRender: string[] = [];
	const currentSessionChanges: string[] = [];
	const pi = {
		on() {},
		registerCommand(name: string, definition: typeof command) {
			assert.equal(name, "defaults");
			command = definition;
		},
		async setModel(model: { provider: string; id: string }) {
			currentSessionChanges.push(`${model.provider}/${model.id}`);
			return true;
		},
		setThinkingLevel(level: string) {
			currentSessionChanges.push(level);
		},
	} as any;

	registerFixedDefaults(pi, {
		read: async () => config,
		write: async (next) => {
			saved = next;
		},
	});
	assert.ok(command);

	await command.handler("", {
		scopedModels: pagedScopedModels,
		ui: {
			custom: async (factory: any) => {
				let result: string | undefined;
				const component = await factory(
					{ requestRender() {} },
					{ fg: (_color: string, text: string) => text, bold: (text: string) => text },
					{
						matches: (data: string, action: string) =>
							(action === "tui.select.confirm" && data === "\r") ||
							(action === "tui.select.cancel" && data === "\u001b") ||
							(action === "tui.select.pageDown" && data === "PAGE_DOWN"),
					},
					(value: string | undefined) => {
						result = value;
					},
				);
				initialRender = component.render(80);
				component.handleInput("PAGE_DOWN");
				secondPageRender = component.render(80);
				component.handleInput("gpt");
				component.handleInput("\r");
				return result;
			},
			select: async () => "high",
			notify() {},
		},
	});

	assert.ok(initialRender.some((line) => line.includes("Search:")));
	assert.ok(initialRender.some((line) => line.includes("Page 1/2")));
	assert.ok(secondPageRender.some((line) => line.includes("Page 2/2")));
	assert.deepEqual(saved, { provider: "CLI", model: "gpt-5.6-sol", thinking: "high" });
	assert.deepEqual(currentSessionChanges, []);
});
