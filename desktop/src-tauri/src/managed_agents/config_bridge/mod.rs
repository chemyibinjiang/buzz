mod buzz_agent;
mod claude;
mod codex;
mod goose;
pub(crate) mod reader;
mod schema_walker;
pub(crate) mod types;

pub(crate) use types::*;

/// Read the goose harness config file (`~/.config/goose/config.yaml`).
///
/// Used by readiness evaluation to silence requirements that are already
/// satisfied in the file config layer — the harness reads this file at startup
/// so env vars we would otherwise require are not needed from Buzz.
pub(crate) fn read_goose_file_config() -> Option<RuntimeFileConfig> {
    goose::read_config_file()
}

/// Return whether the selected Codex model provider requires OpenAI auth.
/// `None` preserves the existing CLI-probe fallback when config is invalid or
/// the selected provider cannot be classified.
pub(crate) fn read_codex_requires_openai_auth() -> Option<bool> {
    codex::read_requires_openai_auth()
}
