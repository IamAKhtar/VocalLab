(() => {
  const SONGS = [
    {
      id: 'vande_mataram',
      title: 'Vande Mataram (Simple)',
      artist: 'Traditional',
      audio: 'songs/vande_mataram.mp3',
      lrc: 'songs/vande_mataram.lrc',
      duration: 30
    }
  ];

  const el = (id) => document.getElementById(id);

  class LRC {
    static async load(url) {
      const txt = await fetch(url).then(r => r.text());
      return LRC.parse(txt);
    }
    static parse(text) {
      const lines = text.split(/\r?\n/);
      const out = [];
      const ts = /^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;
      for (const line of lines) {
        const m = ts.exec(line.trim());
        if (!m) continue;
        const mm = +m[1], ss = +m[2], cs = m[3] ? +m[3] : 0;
        const t = mm * 60 + ss + cs / (m[3]?.length === 3 ? 1000 : 100);
        const text = m[4].trim();
        if (text) out.push({ t, text });
      }
      return out.sort((a, b) => a.t - b.t);
    }
    static window(lines, t, k = 1) {
      let idx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].t <= t) idx = i; else break;
      }
      const curr = lines[idx] || null;
      const prev = lines[idx - 1] || null;
      const next = lines[idx + 1] || null;
      return { idx, prev, curr, next };
    }
  }

  class KaraokeApp {
    constructor() {
      this.audio = el('backing');
      this.playBtn = el('playBtn');
      this.recBtn = el('recBtn');
      this.stopBtn = el('stopBtn');
      this.songSel = el('songSelect');
      this.loadBtn = el('loadSongBtn');
      this.lyPrev = el('lyricsPrev');
      this.lyCurr = el('lyricsCurr');
      this.lyNext = el('lyricsNext');
      this.prog = el('progBar');
      this.results = el('results');

      this.ctx = null;
      this.stream = null;
      this.recorder = null;
      this.chunks = [];
      this.analyser = null;
      this.energyBuf = [];
      this.onsets = [];
      this.lrc = [];
      this.loaded = false;
      this.isRecording = false;

      this.bind();
      this.populateSongs();
    }

    bind() {
      this.audio.addEventListener('timeupdate', () => this.tick());
      this.playBtn.addEventListener('click', () => this.togglePlay());
      this.recBtn.addEventListener('click', () => this.toggleRec());
      this.stopBtn.addEventListener('click', () => this.finish());
      this.loadBtn.addEventListener('click', () => this.loadSong());
    }

    populateSongs() {
      console.log('Populating songs:', SONGS);
      this.songSel.innerHTML = '';
      for (const s of SONGS) {
        const opt = document.createElement('option');
        opt.value = s.id; 
        opt.textContent = `${s.title} — ${s.artist}`;
        this.songSel.appendChild(opt);
      }
      // Auto-load first song
      if (SONGS.length > 0) {
        this.loadSong();
      }
    }

    async loadSong() {
      const id = this.songSel.value;
      const song = SONGS.find(s => s.id === id);
      if (!song) return;
      
      console.log('Loading song:', song);
      this.audio.src = song.audio;
      
      try {
        this.lrc = await LRC.load(song.lrc);
        this.loaded = true;
        this.results.hidden = true;
        this.lyPrev.textContent = '';
        this.lyCurr.textContent = 'Ready when you are…';
        this.lyNext.textContent = this.lrc[0]?.text || '';
        this.prog.style.width = '0%';
        console.log('Song loaded successfully, LRC lines:', this.lrc.length);
      } catch (error) {
        console.error('Error loading song:', error);
        this.lyCurr.textContent = 'Error loading song. Check console.';
      }
    }

    tick() {
      if (!this.loaded) return;
      const t = this.audio.currentTime;
      const { prev, curr, next } = LRC.window(this.lrc, t);
      this.lyPrev.textContent = prev?.text || '';
      this.lyCurr.textContent = curr?.text || '';
      this.lyNext.textContent = next?.text || '';

      const pct = (t / (this.audio.duration || 1)) * 100;
      this.prog.style.width = `${Math.min(pct, 100)}%`;
    }

    async togglePlay() {
      if (!this.loaded) await this.loadSong();
      if (this.audio.paused) {
        await this.audio.play();
        this.playBtn.textContent = 'Pause';
      } else {
        this.audio.pause();
        this.playBtn.textContent = 'Play';
      }
    }

    async toggleRec() {
      if (!this.loaded) await this.loadSong();
      if (!this.isRecording) {
        await this.startRec();
      } else {
        await this.finish();
      }
    }

    async startRec() {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }});
      this.recorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm' });
      this.chunks = [];
      this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
      this.recorder.onstop = () => this.score();

      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);

      this.onsets = [];
      this.energyBuf = [];
      this.energyLoop();

      this.isRecording = true;
      this.recBtn.textContent = 'Recording…';
      this.stopBtn.disabled = false;
      this.playBtn.disabled = true;

      this.recorder.start(100);
      this.audio.currentTime = 0;
      await this.audio.play();
    }

    energyLoop() {
      if (!this.analyser) return;
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = this.audio.currentTime || 0;
      this.energyBuf.push({ t: now, rms });

      const N = this.energyBuf.length;
      if (N > 6) {
        const a = this.energyBuf[N - 6].rms;
        const b = this.energyBuf[N - 1].rms;
        const lastOnset = this.onsets.length ? this.onsets[this.onsets.length - 1] : -999;
        if (b > 0.04 && b > a * 1.8 && (now - lastOnset) > 0.25) {
          this.onsets.push(now);
        }
      }

      if (this.energyBuf.length > 3000) this.energyBuf.splice(0, 1500);
      this._raf = requestAnimationFrame(() => this.energyLoop());
    }

    async finish() {
      if (this.recorder && this.isRecording) {
        this.isRecording = false;
        this.recBtn.textContent = 'Start Recording';
        this.stopBtn.disabled = true;
        this.playBtn.disabled = false;

        this.audio.pause();
        try { this.recorder.stop(); } catch {}
        try { this.stream.getTracks().forEach(tr => tr.stop()); } catch {}
        try { cancelAnimationFrame(this._raf); } catch {}
        this.analyser = null;
      }
    }

    mapScore01to10(x) {
      const v = Math.max(0, Math.min(1, x));
      return Math.round((1 + 9 * v) * 10) / 10;
    }

    score() {
      const lineTimes = this.lrc.map(l => l.t);
      const on = this.onsets.slice().sort((a,b)=>a-b);

      const pairings = [];
      let i = 0, j = 0;
      while (i < lineTimes.length && j < on.length) {
        const lt = lineTimes[i], ot = on[j];
        if (Math.abs(ot - lt) <= 1.2) { 
          pairings.push({ lt, ot, err: ot - lt }); 
          i++; j++; 
        }
        else if (ot < lt) j++; 
        else i++;
      }

      const absErr = pairings.map(p => Math.abs(p.err));
      const coverage = pairings.length / Math.max(1, lineTimes.length);
      
      const med = (arr) => { 
        if (!arr.length) return 1.0; 
        const s = [...arr].sort((a,b)=>a-b); 
        const m = Math.floor(s.length/2); 
        return s.length % 2 ? s[m] : 0.5*(s[m-1]+s[m]); 
      };
      
      const medErr = med(absErr);
      const timing01 = Math.max(0, 1 - (medErr / 0.6));
      const covBoost = Math.min(0.2, Math.max(0, (coverage - 0.5) * 0.4));
      const rt01 = Math.max(0, Math.min(1, timing01 + covBoost));
      const rt10 = this.mapScore01to10(rt01);

      const voiced = this.energyBuf.filter(x => x.rms > 0.03);
      const meanR = voiced.reduce((a,b)=>a+b.rms,0) / Math.max(1, voiced.length);
      const varR = voiced.reduce((a,b)=>a + Math.pow(b.rms-meanR,2),0) / Math.max(1, voiced.length);
      const ps01 = Math.max(0, 1 - Math.min(1, varR * 90));
      const ps10 = this.mapScore01to10(ps01);

      const good = this.energyBuf.filter(x => x.rms >= 0.035 && x.rms <= 0.25).length;
      const vc01 = Math.min(1, good / Math.max(1, this.energyBuf.length) * 1.6);
      const vc10 = this.mapScore01to10(vc01);

      let dr01 = 0;
      if (voiced.length > 10) {
        const vals = voiced.map(v => v.rms).sort((a,b)=>a-b);
        const p90 = vals[Math.floor(vals.length*0.9)];
        const p10 = vals[Math.floor(vals.length*0.1)];
        const spread = Math.max(0, Math.min(1, (p90 - p10) * 5));
        dr01 = spread;
      }
      const dr10 = this.mapScore01to10(dr01);

      const lineWindows = this.lrc.map(l => {
        const t0 = l.t, t1 = t0 + 1.2;
        const seg = this.energyBuf.filter(e => e.t >= t0 && e.t <= t1);
        const mean = seg.reduce((a,b)=>a+b.rms,0) / Math.max(1, seg.length);
        return mean;
      }).filter(x => x > 0);
      
      const mL = lineWindows.reduce((a,b)=>a+b,0) / Math.max(1, lineWindows.length);
      const vL = lineWindows.reduce((a,b)=>a + Math.pow(b-mL,2),0) / Math.max(1, lineWindows.length);
      const bc01 = Math.max(0, 1 - Math.min(1, Math.sqrt(vL) * 8));
      const bc10 = this.mapScore01to10(bc01);

      const density = on.length / Math.max(1, lineTimes.length);
      const nt01 = Math.max(0, 1 - Math.abs(density - 1.0));
      const nt10 = this.mapScore01to10(nt01);

      const overall01 = rt01*0.25 + ps01*0.15 + vc01*0.15 + dr01*0.1 + bc01*0.15 + nt01*0.2;
      const overall = Math.round(overall01 * 100);

      document.getElementById('rtScore').textContent = rt10.toFixed(1) + '/10';
      document.getElementById('psScore').textContent = ps10.toFixed(1) + '/10';
      document.getElementById('vcScore').textContent = vc10.toFixed(1) + '/10';
      document.getElementById('drScore').textContent = dr10.toFixed(1) + '/10';
      document.getElementById('bcScore').textContent = bc10.toFixed(1) + '/10';
      document.getElementById('ntScore').textContent = nt10.toFixed(1) + '/10';
      document.getElementById('overallScore').textContent = overall.toString();
      document.getElementById('results').hidden = false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => { 
    console.log('DOM loaded, starting Karaoke app');
    new KaraokeApp(); 
  });
})();