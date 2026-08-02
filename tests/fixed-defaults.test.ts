// @ts-ignore -- standalone extension checkout has no local Node type roots.
import assert from "node:assert/strict";
// @ts-ignore -- standalone extension checkout has no local Node type roots.
import test from "node:test";
import { filterScopedModels, isModelInScope, registerFixedDefaults } from "../extensions/fixed-defaults.ts";

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

function createHarness() {
	const selected: string[] = [];
	const handlers = new Map<string, (...args: any[]) => any>();
	const pi = {
		on(event: string, handler: (...args: any[]) => any) {
			handlers.set(event, handler);
		},
		registerCommand() {},
		async setModel(model: { provider: string; id: string }) {
			selected.push(`model:${model.provider}/${model.id}`);
			return true;
		},
		setThinkingLevel(level: string) {
			selected.push(`thinking:${level}`);
		},
	} as any;
	return { selected, handlers, pi };
}

function baseCtx(overrides: Record<string, unknown> = {}) {
	return {
		modelRegistry: { find: (provider: string, model: string) => ({ provider, id: model }) },
		scopedModels,
		ui: { notify() {} },
		sessionManager: { getEntries: () => [] },
		...overrides,
	};
}

function required<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("Required harness registration is missing");
	return value;
}

test("filters only the supplied scoped models", () => {
	assert.deepEqual(
		filterScopedModels(scopedModels, "grok").map((item) => item.model.id),
		["grok-4.5"],
	);
});

test("isModelInScope treats empty scoped list as unrestricted", () => {
	assert.equal(isModelInScope({ provider: "CLI", id: "anything" }, []), true);
	assert.equal(isModelInScope({ provider: "CLI", id: "grok-4.5" }, scopedModels), true);
	assert.equal(isModelInScope({ provider: "CLI", id: "blocked" }, scopedModels), false);
	assert.equal(isModelInScope(undefined, scopedModels), false);
});

test("applies fixed defaults on startup and new", async () => {
	const { selected, handlers, pi } = createHarness();
	registerFixedDefaults(pi, store);
	const onSessionStart = required(handlers.get("session_start"));

	const ctx = baseCtx({ model: undefined });
	await onSessionStart({ reason: "startup" }, ctx);
	await onSessionStart({ reason: "new" }, ctx);

	assert.deepEqual(selected, [
		"model:CLI/grok-4.5",
		"thinking:high",
		"model:CLI/grok-4.5",
		"thinking:high",
	]);
});

test("startup still applies defaults after Pi writes initial model metadata", async () => {
	const { selected, handlers, pi } = createHarness();
	registerFixedDefaults(pi, store);
	const onSessionStart = required(handlers.get("session_start"));

	await onSessionStart(
		{ reason: "startup" },
		baseCtx({
			model: { provider: "CLI", id: "gpt-5.6-sol" },
			sessionManager: {
				getEntries: () => [{ type: "model_change" }, { type: "thinking_level_change" }],
			},
		}),
	);

	assert.deepEqual(selected, ["model:CLI/grok-4.5", "thinking:high"]);
});

test("session-restoring CLI startup preserves model and thinking", async () => {
	for (const argv of [
		["pi", "--session", "/tmp/existing-session.jsonl"],
		["pi", "--session=/tmp/existing-session.jsonl"],
		["pi", "--continue"],
		["pi", "-c"],
		["pi", "--resume"],
		["pi", "-r"],
		["pi", "--fork", "/tmp/existing-session.jsonl"],
	]) {
		const { selected, handlers, pi } = createHarness();
		registerFixedDefaults(pi, store, argv);
		const onSessionStart = required(handlers.get("session_start"));

		await onSessionStart(
			{ reason: "startup" },
			baseCtx({ model: { provider: "CLI", id: "gpt-5.6-sol" } }),
		);

		assert.deepEqual(selected, [], argv.join(" "));
	}
});

test("resume fork reload preserve an allowed saved model", async () => {
	const { selected, handlers, pi } = createHarness();
	registerFixedDefaults(pi, store);
	const onSessionStart = required(handlers.get("session_start"));

	const ctx = baseCtx({
		model: { provider: "CLI", id: "gpt-5.6-sol" },
	});
	for (const reason of ["resume", "fork", "reload"]) {
		await onSessionStart({ reason }, ctx);
	}

	assert.deepEqual(selected, []);
});

test("resume fork reload preserve existing restored models", async () => {
	const { selected, handlers, pi } = createHarness();
	registerFixedDefaults(pi, store);
	const onSessionStart = required(handlers.get("session_start"));

	for (const reason of ["resume", "fork", "reload"]) {
		await onSessionStart(
			{ reason },
			baseCtx({ model: { provider: "other", id: "existing-model" } }),
		);
	}

	assert.deepEqual(selected, []);
});

test("empty scopedModels leaves resume model unrestricted", async () => {
	const { selected, handlers, pi } = createHarness();
	registerFixedDefaults(pi, store);
	const onSessionStart = required(handlers.get("session_start"));

	await onSessionStart(
		{ reason: "resume" },
		baseCtx({
			scopedModels: [],
			model: { provider: "CLI", id: "claude-fable-5" },
		}),
	);

	assert.deepEqual(selected, []);
});

test("model_select reverts out-of-scope once and preserves allowed selections", async () => {
	const { selected, handlers, pi } = createHarness();
	let currentModel: { provider: string; id: string } | undefined = {
		provider: "CLI",
		id: "gpt-5.6-sol",
	};
	pi.setModel = async (model: { provider: string; id: string }) => {
		selected.push(`model:${model.provider}/${model.id}`);
		currentModel = model;
		const onModelSelect = handlers.get("model_select");
		if (onModelSelect) {
			await onModelSelect(
				{ model },
				baseCtx({ model: currentModel }),
			);
		}
		return true;
	};

	registerFixedDefaults(pi, store);
	const onModelSelect = required(handlers.get("model_select"));

	await onModelSelect(
		{ model: { provider: "CLI", id: "claude-fable-5" } },
		baseCtx({ model: { provider: "CLI", id: "claude-fable-5" } }),
	);
	assert.deepEqual(selected, ["model:CLI/grok-4.5", "thinking:high"]);

	selected.length = 0;
	await onModelSelect(
		{ model: { provider: "CLI", id: "gpt-5.6-sol" } },
		baseCtx({ model: { provider: "CLI", id: "gpt-5.6-sol" } }),
	);
	assert.deepEqual(selected, []);
});

test("model_select ignores restored model selections", async () => {
	const { selected, handlers, pi } = createHarness();
	registerFixedDefaults(pi, store);
	const onModelSelect = required(handlers.get("model_select"));

	await onModelSelect(
		{
			model: { provider: "other", id: "existing-model" },
			source: "restore",
		},
		baseCtx({ model: { provider: "other", id: "existing-model" } }),
	);

	assert.deepEqual(selected, []);
});

test("already on fixed model skips setModel but still corrects thinking", async () => {
	const { selected, handlers, pi } = createHarness();
	registerFixedDefaults(pi, store);
	const onSessionStart = required(handlers.get("session_start"));

	await onSessionStart(
		{ reason: "startup" },
		baseCtx({
			model: { provider: "CLI", id: "grok-4.5" },
		}),
	);

	assert.deepEqual(selected, ["thinking:high"]);
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
	const defaultsCommand = required(command);

	await defaultsCommand.handler("", {
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
