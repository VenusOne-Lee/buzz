//! `buzz spine` — publish the Spine emitted per-channel index (kind:30023).
//!
//! The index is a parameterized replaceable event keyed by
//! `d = channel-digest:<channel-uuid>`, scoped to the channel with an `h` tag,
//! and stamped `client = spine-emitter`. The JSON body is produced by the
//! Spine projection pipeline; this command only validates the channel UUID and
//! publishes the body verbatim.

use std::io::Read;

use clap::Subcommand;

use crate::client::{normalize_write_response, BuzzClient};
use crate::error::CliError;
use crate::validate::parse_uuid;

/// Subcommands for `buzz spine`.
#[derive(Subcommand)]
pub enum SpineCmd {
    /// Publish a channel's Spine index (kind:30023, d = channel-digest:<uuid>)
    Emit {
        /// Channel UUID the index describes.
        #[arg(long)]
        channel: String,
        /// Path to the JSON index body, or `-` to read from stdin.
        #[arg(long)]
        body_file: String,
    },
}

/// Publish the Spine index for `channel` with the body read from `body_file`.
pub async fn cmd_emit(client: &BuzzClient, channel: &str, body_file: &str) -> Result<(), CliError> {
    let channel_id = parse_uuid(channel)?;
    let body = read_body(body_file)?;

    let builder = buzz_sdk::build_spine_index(&channel_id, &body)
        .map_err(|e| CliError::Other(format!("build error: {e}")))?;

    let event = client.sign_event(builder)?;
    let resp = client.submit_event(event).await?;
    println!("{}", normalize_write_response(&resp));
    Ok(())
}

/// Read the index body from a file path, or from stdin when the path is `-`.
fn read_body(path: &str) -> Result<String, CliError> {
    if path == "-" {
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .map_err(|e| CliError::Usage(format!("failed to read body from stdin: {e}")))?;
        Ok(buf)
    } else {
        std::fs::read_to_string(path)
            .map_err(|e| CliError::Usage(format!("failed to read body file {path}: {e}")))
    }
}

/// Dispatch a parsed `buzz spine` subcommand.
pub async fn dispatch(cmd: SpineCmd, client: &BuzzClient) -> Result<(), CliError> {
    match cmd {
        SpineCmd::Emit { channel, body_file } => cmd_emit(client, &channel, &body_file).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_body_reads_a_file() {
        let dir = std::env::temp_dir().join("buzz-spine-emit-test");
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("body.json");
        std::fs::write(&path, r#"{"version":1}"#).expect("write body");
        let body = read_body(path.to_str().expect("utf-8 path")).expect("read body");
        assert_eq!(body, r#"{"version":1}"#);
    }

    #[test]
    fn read_body_missing_file_is_usage_error() {
        let err = read_body("/nonexistent/spine-body.json").unwrap_err();
        assert!(matches!(err, CliError::Usage(msg) if msg.contains("failed to read body file")));
    }
}
