// 変数定義
var localMediaStream = null;
var localScriptProcessor = null;
var audioContext = null;
var bufferSize = 1024;
var audioData = []; // 録音データ
var streaming = false;
var mel_spectrums = false;
var recorded_mel_spectrums = false;
var last_shutter = Date.now();
var state = "init";
var lang = false;

// キャンバス
var canvas = document.getElementById('sound_analizer');
var canvasContext = canvas.getContext('2d');

// 音声解析
var audioAnalyser = null;


// 録音バッファ作成（録音中自動で繰り返し呼び出される）
var onAudioProcess = function(e) {
    if (!streaming) return;

    // 音声のバッファを作成
    var input = e.inputBuffer.getChannelData(0);
    var bufferData = new Float32Array(bufferSize);
    for (var i = 0; i < bufferSize; i++) {
        bufferData[i] = input[i];
    }
    audioData.push(bufferData);

    // 波形を解析
    analyseVoice();
};

// Please see
// https://qiita.com/tmtakashi_dist/items/eecb705ea48260db0b62
var hz2mel = function (f) {
    return 2595 * Math.log(f / 700 + 1);
}
var mel2hz = function (m) {
    return 700 * (Math.exp(m / 2595) - 1);
}
var melFilterBank = function (fdiv, fnum, melChannels) {
    let fmax = fdiv * (fnum - 1);
    let melmax = hz2mel(fmax);
    let dmel = melmax / (melChannels + 1);
    let melcenters = new Float32Array(melChannels);
    let fcenters = new Float32Array(melChannels);
    let indexcenters = new Float32Array(melChannels);
    for (let i = 0; i < melChannels; i++) {
        melcenters[i] = (i + 1) * dmel;
        fcenters[i] = mel2hz(melcenters[i]);
        indexcenters[i] = Math.round(fcenters[i] / fdiv);
    }
    let indexstarts = new Float32Array(melChannels);
    for (let i = 0; i < melChannels; i++) {
        if (i == 0) {
            indexstarts[i] = 0;
        }
        else {
            indexstarts[i] = indexcenters[i-1];
        }
    }
    let indexstops = new Float32Array(melChannels);
    for (let i = 0; i < melChannels; i++) {
        if (i == melChannels - 1) {
            indexstops[i] = 0;
        }
        else {
            indexstops[i] = indexcenters[i+1];
        }
    }
    filterbank = new Array(melChannels);
    for(x = 0; x < melChannels; x++) {
        filterbank[x] = new Float32Array(fnum);
        let increment = 1.0 / (indexcenters[x] - indexstarts[x]);
        for(y = 0; y < fnum; y++) {
            filterbank[x][y] = 0;
        }
        for(y = indexstarts[x]; y < indexcenters[x]; y++) {
            filterbank[x][y] = (y - indexstarts[x]) * increment;
        }
        let decrement = 1.0 / (indexstops[x] - indexcenters[x]);
        for(y = indexcenters[x]; y < indexstops[x]; y++) {
            filterbank[x][y] = 1.0 - (y - indexcenters[x]) * decrement;
        }
    }

    return {filterbank: filterbank, indexcenters: indexcenters};
}

// 解析用処理
var analyseVoice = function() {
    var fsDivN = audioContext.sampleRate / audioAnalyser.fftSize;
    var spectrums = new Uint8Array(audioAnalyser.frequencyBinCount);
    // TODO We should apply hamming window
    audioAnalyser.getByteFrequencyData(spectrums);
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.font = "bold 20px 'ＭＳ 明朝'";
    let lower_margin = 30;
    let right_margin = 20;
    let left_margin = 40;

    // 周波数スペクトラムとx軸ラベルの描画
    canvasContext.beginPath();
    let x_label_count = 0;
    canvasContext.strokeStyle = "#000";
    canvasContext.lineWidth = 1;
    for (var i = 0, len = spectrums.length; i < len; i++) {
        var x = (i / len) * (canvas.width - left_margin - right_margin);
        var y = (1 - (spectrums[i] / 255)) * (canvas.height - lower_margin);
        // 周波数スペクトラム
        if (i === 0) {
            canvasContext.moveTo(x + left_margin, y);
        } else {
            canvasContext.lineTo(x + left_margin, y);
        }
        // x軸ラベル
        let f = Math.floor(i * fsDivN);  // index -> frequency;
        if (f > x_label_count * 5000) {
            let text = String(x_label_count * 5) + "kHz";
            canvasContext.fillText(text, x + left_margin, canvas.height - 5);
            x_label_count = x_label_count + 1;
        }
    }
    canvasContext.stroke();

    // メルフィルタバンクを利用した包絡線を計算
    canvasContext.beginPath();
    canvasContext.strokeStyle = "#f00";
    canvasContext.lineWidth = 3;
    let mel_chan = 20;
    let ret = melFilterBank(fsDivN, spectrums.length, mel_chan);
    let filterbank = ret["filterbank"];
    let indexcenters = ret["indexcenters"];
    // console.log(indexcenters);
    mel_spectrums = new Float32Array(spectrums.length);
    for (let x = 0; x < mel_chan; x++) {
        for (let y = 0; y < mel_spectrums.length; y++) {
            // メルスペクトラムを計算
            mel_spectrums[y] = mel_spectrums[y] + filterbank[x][y] * spectrums[indexcenters[x]];
        }
    }

    // 録音した包絡線（特徴量）の描画
    for (var i = 0, len = recorded_mel_spectrums.length; i < len; i++) {
        var x = (i / len) * (canvas.width - left_margin - right_margin);
        var y = (1 - (recorded_mel_spectrums[i] / 255)) * (canvas.height - lower_margin);
        if (i === 0) {
            canvasContext.moveTo(x + left_margin, y);
        } else {
            canvasContext.lineTo(x + left_margin, y);
        }
    }
    canvasContext.stroke();

    // Draw grid (X)
    canvasContext.fillRect(left_margin, 0, 1, (canvas.height - lower_margin));
    // x軸の線とラベル出力
    var textYs = ['1.00', '0.50', '0.00'];
    for (var i = 0, len = textYs.length; i < len; i++) {
        var text = textYs[i];
        var gy   = (1 - parseFloat(text)) * (canvas.height - lower_margin);
        // Draw grid (Y)
        canvasContext.fillRect(left_margin, gy, canvas.width, 1);
        // Draw text (Y)
        canvasContext.fillText(text, 0, gy + lower_margin / 2.0);
    }

    // The current sound is near the recorded sound, click shutter
    let diff = 0;
    for(let i = 0, len = mel_spectrums.length; i < len; i++) {
        diff += Math.pow(mel_spectrums[i] - recorded_mel_spectrums[i], 2);
    }
    if (diff < 150 * mel_spectrums.length && // parameter tuning is must
        Date.now() - last_shutter > 2000) // wait 2000[ms] after the last shutter
    {
        shutter_clicked();
        last_shutter = Date.now();
    }
}


// 解析開始
var startStreaming = function() {
    // Clear canvas
    const ids = ["camera_raw", "camera_mono", "camera_kp"];
    for (let i = 0; i < ids.length; i++) {
        let cvs = document.querySelector("#" + ids[i]);
        let ctx = cvs.getContext("2d");
        console.log(cvs);
        ctx.clearRect(0, 0, cvs.width, cvs.height);
    }

    streaming = true;
    // se.play();

    // カメラ設定
    const constraints = {
        audio: true,
        video: {
            // facingMode: "user"   // フロントカメラを利用する
            facingMode: "environment"   // フロントカメラを利用する
            // facingMode: { exact: "environment" }  // リアカメラを利用する場合
        }
    };

    // navigator.getUserMedia({audio: true}, function(stream) {
    navigator.mediaDevices.getUserMedia(constraints)
        .then( function (stream) {
            // カメラを<video>と同期
            video.srcObject = stream;

            // 録音関連
                // audioContext must be created after user gesture
            if (!audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContext();
            }
            localMediaStream = stream;
            var scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
            localScriptProcessor = scriptProcessor;
            var mediastreamsource = audioContext.createMediaStreamSource(stream);
            mediastreamsource.connect(scriptProcessor);
            scriptProcessor.onaudioprocess = onAudioProcess;
            scriptProcessor.connect(audioContext.destination);

            // 音声解析関連
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 2048;
            frequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
            timeDomainData = new Uint8Array(audioAnalyser.frequencyBinCount);
            mediastreamsource.connect(audioAnalyser);
        })
        .catch( function (err) {
            console.log(err.name + ": " + err.message);
        });
};

var Record = function() {
    recorded_mel_spectrums = mel_spectrums;
    last_shutter = Date.now();
};

// 解析終了
var endStreaming = function() {
    // end audio
    streaming = false;
    let tracks_audio = localMediaStream.getTracks();
    tracks_audio.forEach( (track) => {
        track.stop();
    })
    recorded_mel_spectrums = false;

    // end camera
    let tracks_camera = video.srcObject.getTracks();
    tracks_camera.forEach( (track) => {
        track.stop();
    })
};

var set_state = function(arg_state) {
  state = arg_state;
}

var change_content = function() {
    console.log(state);
    console.log(lang);
    if (state == "init") {
    }
    else if (state == "start") {
        let state_id = document.querySelector("#state");
        if (lang == "ja") {
            state_id.textContent = "写真を取るトリガーとして登録したい音声を発しながら、音声登録ボタンを押してください。";
        }
        else if (lang == "en") {
            state_id.textContent = "Press 'Register' button while speaking the voice you want to register as a trigger to take a photo";
        }
    }
    else if (state == "record") {
        let state_id = document.querySelector("#state");
        if (lang == "ja") {
            state_id.textContent = "登録した音声が聞こえたら写真を撮ります。写真は右クリックor長押しで保存できます。";
        }
        else if (lang == "en") {
            state_id.textContent = "Take a photo when the registered voice is recognized. Right click or press and hold the photo to save the photo.";
        }
    }
    else if (state == "stop") {
        let state_id = document.querySelector("#state");
        if (lang == "ja") {
            state_id.textContent = "「スタート」ボタンを押して開始してください。";
        }
        else if (lang == "en") {
            state_id.textContent = "Press 'Start' button to start.";
        }
    }
    else {
        let state_id = document.querySelector("#state");
        if (lang == "ja") {
            state_id.textContent = "エラーが発生したので、ページをリロードしてください。";
        }
        else if (lang == "en") {
            state_id.textContent = "Error has occurred, please reload the page.";
        }
    }
}

function reflesh_page () {
    // Resize canvas
    resize_canvas(window.innerWidth);
    // Colorize webpage background
    let background = document.querySelector(".background");
    addTriangleTo(background, background.scrollWidth, background.scrollHeight);
}

 // =========================================================
 //      選択された言語のみ表示
 // =========================================================
function langSet(argLang){

  // --- 切り替え対象のclass一覧を取得 ----------------------
  var elm = document.getElementsByClassName("langCng");

  for (var i = 0; i < elm.length; i++) {

    // --- 選択された言語と一致は表示、その他は非表示 -------
    if(elm[i].getAttribute("lang") == argLang){
      elm[i].style.display = '';
    }
    else{
      elm[i].style.display = 'none';
    }
  }

  lang = argLang;
}

// Main code
window.onload = () => {
    reflesh_page();

    // Window is resized
    window.addEventListener( 'resize', function() {
        reflesh_page();
    }, false );

    // ボタンクリック時のコールバックを登録
    document.querySelector("#start").addEventListener("click", {handleEvent: startStreaming});
    document.querySelector("#record").addEventListener("click", {handleEvent: Record});
    document.querySelector("#stop").addEventListener("click", {handleEvent: endStreaming});

    // Save images when clicked
    save_clicked_images();

    // Change state description
    const ids = ["start", "record", "stop"];
    for (let i = 0; i < ids.length; i++) {
        document.querySelector("#" + ids[i]).addEventListener("click", () => {
            set_state(ids[i]);
            change_content();
        }, false);
    }

    // --- ブラウザのデフォルト言語を取得して初回の表示 -----
    lang = (navigator.browserLanguage || navigator.language || navigator.userLanguage).substr(0,2);
    langSet(lang);
};
