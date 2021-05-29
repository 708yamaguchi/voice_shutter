const video  = document.querySelector("#camera");
// const se = new Audio("audio/camera-shutter1.mp3");

function shutter_clicked () {
    const video  = document.querySelector("#camera");
    const canvas = document.querySelector("#camera_raw");

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    const ctx = canvas.getContext("2d");

    Glayer.fadeIn('glayer', 200);
    Glayer.fadeOut('glayer', 200);
    // 演出的な目的で一度映像を止めてSEを再生する
    // se.play();      // シャッター音
    // video.pause();  // 映像を停止
    // setTimeout( () => {
    //     video.play();    // 0.5秒後にカメラ再開
    // }, 500);

    // canvasに画像を貼り付ける
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Binarize with OpenCV.js
    let src = cv.imread("camera_raw");
    let dst = new cv.Mat();
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(dst, dst, 0, 255, cv.THRESH_OTSU);
    cv.imshow("camera_mono", dst);
    src.delete();
    dst.delete();

    // Extract ORB feature with OpenCV.js
    let orb = new cv.ORB();
    const img_camera = cv.imread("camera_raw");
    let kp_camera = new cv.KeyPointVector();
    let dp_camera = new cv.Mat();
    orb.detect(img_camera, kp_camera);
    let kp_img_camera = new cv.Mat();
    cv.drawKeypoints(img_camera, kp_camera, kp_img_camera);
    cv.imshow("camera_kp", kp_img_camera);
    orb.delete();
    kp_camera.delete();
    dp_camera.delete();
    kp_img_camera.delete();
}

function saveCanvas(canvas_id)
{
    console.log(canvas_id);
	var canvas = document.getElementById(canvas_id);
	//アンカータグを作成
	var a = document.createElement('a');
	//canvasをJPEG変換し、そのBase64文字列をhrefへセット
	a.href = canvas.toDataURL('image/jpeg', 0.85);
	//ダウンロード時のファイル名を指定
	a.download = canvas_id + '.jpg';
	//クリックイベントを発生させる
	a.click();
}

function save_clicked_images () {
    const ids = ["sound_analizer", "camera_raw", "camera_mono", "camera_kp"];
    for (let i = 0; i < ids.length; i++) {
        $("#"+ids[i]).longpress(function(e) {
            // 長押し時のコード
            saveCanvas(ids[i]);
          },
          function(){}, // 通常クリック時のコールバック
          1000 // 長押しイベントを検知するミリ秒
        );
    }
}
