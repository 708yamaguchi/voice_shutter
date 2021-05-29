function resize_canvas (window_w) {
    // Resize sound analizer
    let canvas = document.querySelector("#sound_analizer");
    canvas.width = window_w * 0.91;

    // Resize cameras
    const ids = ["camera", "camera_raw", "camera_mono", "camera_kp"];
    for (let i = 0; i < ids.length; i++) {
        let canvas = document.querySelector("#" + ids[i]);
        canvas.width = window_w * 0.45;
    }
}
