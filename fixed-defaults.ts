import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext, ScopedModel, ThinkingLevel } from "@earendil-works/pi-coding-agent";

export type FixedDefaults = {
	provider: string;
	model: string;
	thinking: ThinkingLevel;
};

type ConfigStore = {
	read: () => Promise<FixedDefaults>;
	write: (config: FixedDefaults) => Promise<void>;
};

const configPath = join(homedir(), ".pi", "agent", "fixed-defaults.json");
const thinkingLevels: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const defaultStore: ConfigStore = {
	read: async () => {
		try {
			return JSON.parse(await readFile(configPath, "utf8")) as FixedDefaults;
		} catch (error) {
			throw new Error(`Cannot read ${configPath}`, { cause: error });
		}
	},
	write: async (config) => writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8"),
};

export function filterScopedModels(models: readonly ScopedModel[], query: string): ScopedModel[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...models];
	return models.filter(({ model }) =>
		`${model.provider}/${model.id} ${model.name}`.toLowerCase().includes(needle),
	);
}

function selectScopedModel(ctx: ExtensionContext, currentModel: string): Promise<string | undefined> {
	if (ctx.scopedModels.length === 0) {
		ctx.ui.notify("No scoped models configured", "warning");
		return Promise.resolve(undefined);
	}

	return ctx.ui.custom<string | undefined>((tui, theme, keybindings, done) => {
		const pageSize = 10;
		let query = "";
		let filtered = filterScopedModels(ctx.scopedModels, query);
		let selected = Math.max(
			0,
			filtered.findIndex(({ model }) => `${model.provider}/${model.id}` === currentModel),
		);

		const resetFilter = () => {
			filtered = filterScopedModels(ctx.scopedModels, query);
			selected = 0;
		};
		const selectCurrent = () => {
			const model = filtered[selected]?.model;
			done(model ? `${model.provider}/${model.id}` : undefined);
		};

		return {
			render(width: number) {
				const page = Math.floor(selected / pageSize);
				const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
				const start = page * pageSize;
				const lines = [
					theme.fg("accent", theme.bold("Default model — scoped models only")),
					"",
					`Search: ${query}█`,
					"",
				];
				for (const [offset, { model }] of filtered.slice(start, start + pageSize).entries()) {
					const index = start + offset;
					const id = `${model.provider}/${model.id}`;
					lines.push(`${index === selected ? "→" : " "} ${id}${id === currentModel ? " ✓" : ""}`);
				}
				if (filtered.length === 0) lines.push(theme.fg("muted", "  No matching scoped models"));
				lines.push("", `Page ${filtered.length === 0 ? 0 : page + 1}/${filtered.length === 0 ? 0 : pages}`);
				lines.push(theme.fg("dim", "type to filter • ↑↓/pgup/pgdn navigate • enter select • esc cancel"));
				return lines.map((line) => line.slice(0, Math.max(1, width)));
			},
			invalidate() {},
			handleInput(data: string) {
				if (keybindings.matches(data, "tui.select.cancel")) {
					done(undefined);
					return;
				}
				if (keybindings.matches(data, "tui.select.confirm")) {
					selectCurrent();
					return;
				}
				if (keybindings.matches(data, "tui.select.up") && filtered.length > 0) {
					selected = selected === 0 ? filtered.length - 1 : selected - 1;
				} else if (keybindings.matches(data, "tui.select.down") && filtered.length > 0) {
					selected = (selected + 1) % filtered.length;
				} else if (keybindings.matches(data, "tui.select.pageUp") && filtered.length > 0) {
					selected = Math.max(0, selected - pageSize);
				} else if (keybindings.matches(data, "tui.select.pageDown") && filtered.length > 0) {
					selected = Math.min(filtered.length - 1, selected + pageSize);
				} else if (keybindings.matches(data, "tui.editor.deleteCharBackward")) {
					query = Array.from(query).slice(0, -1).join("");
					resetFilter();
				} else {
					const text = Array.from(data)
						.filter((character) => character >= " " && character !== "\u007f")
						.join("");
					if (text) {
						query += text;
						resetFilter();
					}
				}
				tui.requestRender();
			},
		};
	});
}

export function registerFixedDefaults(pi: ExtensionAPI, store: ConfigStore = defaultStore): void {
	async function apply(config: FixedDefaults, ctx: ExtensionContext): Promise<boolean> {
		const model = ctx.modelRegistry.find(config.provider, config.model);
		if (!model || !(await pi.setModel(model))) {
			ctx.ui.notify(`Fixed defaults: unavailable model ${config.provider}/${config.model}`, "warning");
			return false;
		}
		pi.setThinkingLevel(config.thinking);
		return true;
	}

	pi.registerCommand("defaults", {
		description: "Set the model and thinking level used by fresh sessions",
		handler: async (_args, ctx) => {
			try {
				const current = await store.read();
				const currentModel = `${current.provider}/${current.model}`;
				const modelId = await selectScopedModel(ctx, currentModel);
				if (!modelId) return;

				const thinking = await ctx.ui.select("Default thinking", [
					current.thinking,
					...thinkingLevels.filter((level) => level !== current.thinking),
				]);
				if (!thinking) return;

				const slash = modelId.indexOf("/");
				const next = {
					provider: modelId.slice(0, slash),
					model: modelId.slice(slash + 1),
					thinking: thinking as ThinkingLevel,
				};
				await store.write(next);
				ctx.ui.notify(`Fresh sessions: ${modelId} (${next.thinking})`, "info");
			} catch (error) {
				ctx.ui.notify(`Fixed defaults: ${error instanceof Error ? error.message : String(error)}`, "warning");
			}
		},
	});

	pi.on("session_start", async (event, ctx) => {
		if (event.reason !== "startup" && event.reason !== "new") return;
		try {
			await apply(await store.read(), ctx);
		} catch (error) {
			ctx.ui.notify(`Fixed defaults: ${error instanceof Error ? error.message : String(error)}`, "warning");
		}
	});
}

export default registerFixedDefaults;
