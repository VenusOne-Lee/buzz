use tauri::AppHandle;

/// Returns `Some(error)` when `client_only_mode` is set, preventing spawn.
/// Pure and `AppHandle`-free by design: testable without a Tauri app
/// context, which this codebase has no mock for.
pub(super) fn client_only_mode_refusal(
    global: &crate::managed_agents::GlobalAgentConfig,
) -> Option<String> {
    global.client_only_mode.then(|| {
        "client_only_mode is enabled: this Desktop instance does not run local agents".to_owned()
    })
}

/// Loads the global agent config and applies the `client_only_mode` gate in
/// the same pass — checked before any other refusal or side effect in
/// `spawn_agent_child`, ahead of even `spawn_key_refusal`. Returns the loaded
/// config on success so the caller can reuse it (model/provider fallback,
/// env-var merge) without a second load.
pub(super) fn load_global_config_or_refuse(
    app: &AppHandle,
) -> Result<crate::managed_agents::GlobalAgentConfig, String> {
    let global = crate::managed_agents::load_global_agent_config(app).unwrap_or_default();
    match client_only_mode_refusal(&global) {
        Some(error) => Err(error),
        None => Ok(global),
    }
}

#[cfg(test)]
mod tests {
    use super::client_only_mode_refusal;

    #[test]
    fn client_only_mode_off_does_not_refuse() {
        let global = crate::managed_agents::GlobalAgentConfig::default();
        assert!(client_only_mode_refusal(&global).is_none());
    }

    #[test]
    fn client_only_mode_on_refuses_immediately() {
        let global = crate::managed_agents::GlobalAgentConfig {
            client_only_mode: true,
            ..Default::default()
        };
        assert!(client_only_mode_refusal(&global).is_some());
    }
}
