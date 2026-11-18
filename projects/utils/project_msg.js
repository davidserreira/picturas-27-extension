const { send_rabbit_msg, read_rabbit_msg } = require('./rabbit_mq')
const { v4: uuidv4 } = require('uuid')

const queues = {
    'cut': 'cut_queue',
    'scale': 'scale_queue',
    'border': 'border_queue',
    'saturation': 'saturation_queue',
    'brightness': 'brightness_queue',
    'contrast': 'contrast_queue',
    'binarization': 'binarization_queue',
    'resize': 'resize_queue',
    'rotate': 'rotate_queue',
    'cut_ai': 'cut_ai_queue',
    'upgrade_ai': 'upgrade_ai_queue',
    'bg_remove_ai': 'bg_remove_ai_queue',
    'text_ai': 'text_ai_queue',
    'obj_ai': 'obj_ai_queue',
    'people_ai': 'people_ai_queue',
    'expand_ai': 'expand_ai_queue',
    'watermark': 'watermark_queue',
    'video': 'video_queue',
    'project': 'project_queue',
    'ws': 'ws_queue'
}

function send_msg_tool(msg_id, timestamp, og_img_uri, new_img_uri, tool, params) {
    const queue = queues[tool];
    const msg = {
        "messageId": msg_id,
        "timestamp": timestamp,
        "procedure": tool,
        "parameters": {
            "inputImageURI": og_img_uri,
            "outputImageURI": new_img_uri,
            ... params
        }
    };

    send_rabbit_msg(msg, queue);
}

function send_msg_client(msg_id, timestamp, user) {
    const queue = queues['ws'];
    const msg = {
        "messageId": msg_id,
        "timestamp": timestamp,
        "user": user,
        "status": 'success'
    };

    send_rabbit_msg(msg, queue);
}

function send_msg_client_error(msg_id, timestamp, user, error_code, error_msg) {
    const queue = queues['ws'];
    const msg = {
        "messageId": msg_id,
        "timestamp": timestamp,
        "user": user,
        "status": "error",
        "errorCode": error_code,
        "errorMsg": error_msg
    };

    send_rabbit_msg(msg, queue);
}

function send_msg_client_preview(msg_id, timestamp, user, url) {
    const queue = queues['ws'];
    const msg = {
        "messageId": msg_id,
        "timestamp": timestamp,
        "status": 'success',
        "user": user,
        "img_url": url
    };

    send_rabbit_msg(msg, queue);
}

function send_msg_client_preview_error(msg_id, timestamp, user, error_code, error_msg) {
    const queue = queues['ws'];
    const msg = {
        "messageId": msg_id,
        "timestamp": timestamp,
        "user": user,
        "status": "error",
        "errorCode": error_code,
        "errorMsg": error_msg
    };

    send_rabbit_msg(msg, queue);
}

// The same video-progress message the video worker sent to ws_queue in the
// base; the orchestrator now forwards it (ADR-02), with a whole percentage.
function send_msg_client_video_progress(user, projectId, imgId, preview, percent) {
    const queue = queues['ws'];
    const msg = {
        "messageId": `update-client-video-progress-${uuidv4()}`,
        "timestamp": new Date().toISOString(),
        "status": "success",
        "user": user,
        "projectId": projectId,
        "imgId": imgId,
        "preview": !!preview,
        "percent": percent
    };

    send_rabbit_msg(msg, queue);
}

// State of a processing run (ADR-02, see utils/runState.js). The ws_gateway
// delivers it as "run-status" to the project owner and to whoever started it.
function send_msg_run_status(run) {
    const queue = queues['ws'];
    const msg = {
        "messageId": `run-status-${uuidv4()}`,
        "type": "run-status",
        "timestamp": new Date().toISOString(),
        "status": "success",
        "run": run
    };

    send_rabbit_msg(msg, queue);
}

function read_msg(callback){
    read_rabbit_msg(queues['project'], callback);
}

function send_msg_project_op({ projectId, ownerId, op }) {
  const queue = queues["ws"];
  const msg = {
    type: "project-op",
    projectId,
    ownerId,
    op, // payload da operação 
    timestamp: Date.now(),
    status: "success",
  };
  send_rabbit_msg(msg, queue);
}

module.exports = { send_msg_tool, send_msg_client, send_msg_client_error, send_msg_client_preview, send_msg_client_preview_error, send_msg_client_video_progress, send_msg_run_status, read_msg, send_msg_project_op };