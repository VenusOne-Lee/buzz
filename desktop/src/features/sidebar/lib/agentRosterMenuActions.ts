/**
 * The roster row's context menu — pure composition, no side effects, so the
 * toggle labels and disabled state are unit-testable without mounting Radix.
 * Matches the feature map's acceptance test verbatim: "the row context menu
 * (pin, mute, pause, open work, settings) works."
 */
export type AgentRosterMenuActionId =
  | "pin"
  | "unpin"
  | "mute"
  | "unmute"
  | "pause"
  | "openWork"
  | "settings";

export type AgentRosterMenuItem = {
  id: AgentRosterMenuActionId;
  label: string;
  disabled: boolean;
};

export type AgentRosterMenuState = {
  isPinned: boolean;
  isMuted: boolean;
  /** Only a running/deployed agent can be paused (stopped). */
  canPause: boolean;
};

export function buildAgentRosterMenuItems(
  state: AgentRosterMenuState,
): AgentRosterMenuItem[] {
  return [
    {
      id: state.isPinned ? "unpin" : "pin",
      label: state.isPinned ? "Unpin" : "Pin",
      disabled: false,
    },
    {
      id: state.isMuted ? "unmute" : "mute",
      label: state.isMuted ? "Unmute" : "Mute",
      disabled: false,
    },
    {
      id: "pause",
      label: "Pause",
      disabled: !state.canPause,
    },
    {
      id: "openWork",
      label: "Open work",
      disabled: false,
    },
    {
      id: "settings",
      label: "Settings",
      disabled: false,
    },
  ];
}
