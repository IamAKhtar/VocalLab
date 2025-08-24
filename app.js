// VocalMaster - OPTION 1: Full Real Analysis (Advanced) - CORRECTED VERSION
// This version implements comprehensive audio feature extraction and analysis
class VocalMaster {
    constructor() {
        this.audioContext = null;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.recordingData = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordingDuration = 0;
        this.maxRecordingDuration = 30000; // 30 seconds
        this.minRecordingDuration = 3000; // 3 seconds for testing
        this.analysisResults = null;
        this.audioBuffer = null;
        this.audioElement = null;
        this.timerInterval = null;
        this.analyser = null;
        
        // App data
        this.vocalParameters = [
            {name: "Pitch Accuracy", description: "How well your notes match the intended pitch", weight: 0.15, icon: "🎵"},
            {name: "Tone Quality", description: "The warmth, brightness and richness of your voice", weight: 0.12, icon: "🎼"},
            {name: "Rhythm & Timing", description: "How well you stay in time with the beat", weight: 0.12, icon: "⏱️"},
            {name: "Pitch Stability", description: "Consistency of sustained notes without wobble", weight: 0.11, icon: "📐"},
            {name: "Vocal Clarity", description: "Clear articulation and pronunciation", weight: 0.10, icon: "🔊"},
            {name: "Dynamic Range", description: "Control of volume and vocal strength", weight: 0.10, icon: "📊"},
            {name: "Breath Control", description: "Smooth phrasing and breathing technique", weight: 0.10, icon: "💨"},
            {name: "Note Transitions", description: "Smoothness between different notes", weight: 0.08, icon: "🌊"},
            {name: "Vibrato Control", description: "Natural vibrato characteristics", weight: 0.07, icon: "〰️"},
            {name: "Expression", description: "Emotional delivery and musical style", weight: 0.05, icon: "🎭"}
        ];
        
        this.scoreRanges = [
            {min: 90, max: 100, grade: "A+", title: "Outstanding Singer!", message: "You have exceptional vocal control and technique. Consider pursuing vocal training or performance!"},
            {min: 80, max: 89, grade: "A", title: "Excellent Voice!", message: "You have strong singing fundamentals. A few small improvements could make you shine even brighter!"},
            {min: 70, max: 79, grade: "B+", title: "Very Good!", message: "You show real singing potential. Focus on your weaker areas to level up your vocals!"},
            {min: 60, max: 69, grade: "B", title: "Good Effort!", message: "You're on the right track! Practice and you'll see significant improvement."},
            {min: 50, max: 59, grade: "C+", title: "Getting There!", message: "Keep practicing! Focus on pitch accuracy and breath control for quick wins."},
            {min: 40, max: 49, grade: "C", title: "Room to Grow!", message: "Don't give up! Every singer starts somewhere. Try humming along to your favorite songs!"},
            {min: 0, max: 39, grade: "D", title: "Keep Trying!", message: "Singing is a skill that improves with practice. Start with simple melodies and build up!"}
        ];
        
        this.achievements = [
            {name: "First Song", description: "Record your first vocal assessment", icon: "🎤"},
            {name: "Perfect Pitch", description: "Score 95+ on Pitch Accuracy", icon: "🎯"},
            {name: "Smooth Operator", description: "Score 90+ on Note Transitions", icon: "🌊"},
            {name: "Breath Master", description: "Score 85+ on Breath Control", icon: "💨"},
            {name: "Social Singer", description: "Share your score with friends", icon: "📱"},
            {name: "Consistent Performer", description: "Record 5 assessments", icon: "🔄"}
        ];
        
        // User data
        this.userSessions = JSON.parse(localStorage.getItem('vocalmaster_sessions') || '[]');
        this.userPhone = localStorage.getItem('vocalmaster_phone') || null;
        
        this.initializeApp();
    }

    async initializeApp() {
        console.log('Initializing VocalMaster app...');
        this.setupEventListeners();
        await this.initializeAudioContext();
        this.setupWaveformVisualization();
        console.log('App initialized successfully');
    }

    setupEventListeners() {
        // Record button
        const recordButton = document.getElementById('recordButton');
        recordButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Record button clicked, isRecording:', this.isRecording);
            this.toggleRecording();
        });

        // Results actions
        document.getElementById('playButton')?.addEventListener('click', () => this.playRecording());
        document.getElementById('shareButton')?.addEventListener('click', () => this.shareResults());
        document.getElementById('saveButton')?.addEventListener('click', () => this.showSaveModal());
        document.getElementById('retryButton')?.addEventListener('click', () => this.resetToRecording());

        // Save modal
        document.getElementById('closeSaveModal')?.addEventListener('click', () => this.hideSaveModal());
        document.getElementById('confirmSave')?.addEventListener('click', () => {
            console.log('Confirm Save button clicked');
            this.saveResults();
        });
        document.getElementById('cancelSave')?.addEventListener('click', () => this.hideSaveModal());

        // Parameter modal
        document.getElementById('closeParameterModal')?.addEventListener('click', () => this.hideParameterModal());

        // Modal backdrop clicks
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.hideAllModals();
                }
            });
        });
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('Audio context initialized');
        } catch (error) {
            console.error('Audio context initialization failed:', error);
            this.showError('Audio context initialization failed. Please use a supported browser.');
        }
    }

    setupWaveformVisualization() {
        this.canvas = document.getElementById('waveformCanvas');
        this.canvasContext = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.getElementById('waveformContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    async toggleRecording() {
        console.log('Toggle recording called, current state:', this.isRecording);
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        console.log('Starting recording...');
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            console.log('Got media stream');

            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
            });

            this.recordingData = [];

            this.mediaRecorder.ondataavailable = (event) => {
                console.log('Data available:', event.data.size);
                if (event.data.size > 0) {
                    this.recordingData.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, processing recording...');
                this.processRecording();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.showError('Recording failed. Please try again.');
                this.resetRecordingState();
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            console.log('Recording started successfully');
            this.updateRecordingUI(true);
            this.startTimer();
            this.startWaveformVisualization();
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showError('Failed to start recording. Please check microphone permissions and try again.');
            this.resetRecordingState();
        }
    }

    stopRecording() {
        console.log('Stopping recording...');
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.audioStream?.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.recordingDuration = Date.now() - this.recordingStartTime;
            console.log('Recording stopped, duration:', this.recordingDuration);
            this.updateRecordingUI(false);
            this.stopTimer();
            this.stopWaveformVisualization();
        }
    }

    resetRecordingState() {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.stopTimer();
        this.stopWaveformVisualization();
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
    }

    updateRecordingUI(recording) {
        const recordButton = document.getElementById('recordButton');
        const recordIcon = recordButton.querySelector('.record-icon');
        const btnText = recordButton.querySelector('.btn-text');
        console.log('Updating recording UI, recording:', recording);
        if (recording) {
            recordButton.classList.add('recording');
            recordIcon.textContent = '⏹';
            btnText.textContent = 'Stop Recording';
            document.querySelector('.waveform-placeholder').style.display = 'none';
            this.canvas.style.display = 'block';
        } else {
            recordButton.classList.remove('recording');
            recordIcon.textContent = '⏺';
            btnText.textContent = 'Start Recording';
        }
    }

    startTimer() {
        console.log('Starting timer...');
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            document.getElementById('timer').textContent = `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
            const progress = Math.min(elapsed / this.maxRecordingDuration * 100, 100);
            document.getElementById('timerProgressBar').style.width = `${progress}%`;
            if (elapsed >= this.maxRecordingDuration) {
                console.log('Max recording time reached, stopping...');
                this.stopRecording();
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            console.log('Timer stopped');
        }
    }

    startWaveformVisualization() {
        try {
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            source.connect(this.analyser);
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.animateWaveform();
            console.log('Waveform visualization started');
        } catch (error) {
            console.error('Waveform visualization failed:', error);
        }
    }

    animateWaveform() {
        if (!this.isRecording || !this.analyser) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        this.canvasContext.fillStyle = 'rgba(33, 128, 141, 0.1)';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const barWidth = this.canvas.width / (this.dataArray.length / 4);
        let x = 0;
        for (let i = 0; i < this.dataArray.length; i += 4) {
            const barHeight = (this.dataArray[i] / 255) * this.canvas.height * 0.8;
            const gradient = this.canvasContext.createLinearGradient(0, this.canvas.height, 0, this.canvas.height - barHeight);
            gradient.addColorStop(0, '#21808d');
            gradient.addColorStop(1, '#32b8c6');
            this.canvasContext.fillStyle = gradient;
            this.canvasContext.fillRect(x, this.canvas.height - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
        requestAnimationFrame(() => this.animateWaveform());
    }

    stopWaveformVisualization() {
        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (e) {
                console.warn('Error disconnecting analyser:', e);
            }
            this.analyser = null;
        }
    }

    async processRecording() {
        console.log('Processing recording, duration:', this.recordingDuration, 'min required:', this.minRecordingDuration);
        if (this.recordingDuration < this.minRecordingDuration) {
            this.showError(`Please record for at least ${this.minRecordingDuration / 1000} seconds for accurate analysis.`);
            this.resetRecordingUI();
            return;
        }
        if (this.recordingData.length === 0) {
            this.showError('No audio data recorded. Please try again.');
            this.resetRecordingUI();
            return;
        }
        console.log('Showing analysis screen...');
        this.showScreen('analysisScreen');
        try {
            await this.analyzeAudio();
            this.showResults();
        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError('Analysis failed. Please try recording again.');
            this.resetToRecording();
        }
    }

    // OPTION 1: FULL REAL ANALYSIS - Comprehensive audio feature extraction
    async analyzeAudio() {
        console.log('Starting COMPREHENSIVE REAL audio analysis...');
        try {
            // Create audio blob and URL for analysis
            const audioBlob = new Blob(this.recordingData, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            this.audioElement = new Audio(audioUrl);
            console.log('Audio blob created, size:', audioBlob.size);

            // Step 1: Convert audio to analyzable format
            const audioBuffer = await this.decodeAudioData(audioBlob);
            
            // Step 2: Extract comprehensive audio features
            const audioFeatures = await this.extractComprehensiveAudioFeatures(audioBuffer);
            
            // Step 3: Analyze with realistic progress
            const progressSteps = [
                'Processing audio format...',
                'Extracting pitch information...',
                'Analyzing tone quality...',
                'Measuring rhythm patterns...',
                'Evaluating vocal stability...',
                'Calculating final scores...'
            ];

            for (let i = 0; i < progressSteps.length; i++) {
                await this.delay(600 + Math.random() * 400);
                const progress = ((i + 1) / progressSteps.length) * 100;
                document.getElementById('analysisProgress').style.width = `${progress}%`;
                document.getElementById('analysisStatus').textContent = progressSteps[i];
            }

            // Step 4: Generate REAL analysis results based on audio features
            this.analysisResults = this.generateComprehensiveAnalysisResults(audioFeatures);
            console.log('COMPREHENSIVE Analysis complete:', this.analysisResults);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            // Fallback to simulated if real analysis fails
            this.analysisResults = this.generateFallbackResults();
            throw error;
        }
    }

    // Convert audio blob to AudioBuffer for analysis
    async decodeAudioData(audioBlob) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    // Extract comprehensive audio features from recorded audio
    async extractComprehensiveAudioFeatures(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0); // Get mono channel
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        console.log('Analyzing audio:', {
            duration: duration.toFixed(2) + 's',
            sampleRate: sampleRate + 'Hz',
            samples: channelData.length
        });

        // Feature 1: Overall Volume/Energy Analysis
        const overallEnergy = this.calculateRMS(channelData);
        const volumeConsistency = this.calculateVolumeConsistency(channelData);
        
        // Feature 2: Pitch Analysis
        const pitchAnalysis = this.analyzePitchCharacteristics(channelData, sampleRate);
        
        // Feature 3: Spectral Analysis (Tone Quality)
        const spectralFeatures = this.analyzeSpectralCharacteristics(channelData, sampleRate);
        
        // Feature 4: Temporal Analysis (Rhythm/Timing)
        const temporalFeatures = this.analyzeTemporalCharacteristics(channelData, sampleRate);
        
        return {
            duration,
            overallEnergy,
            volumeConsistency,
            pitchAnalysis,
            spectralFeatures,
            temporalFeatures,
            sampleRate,
            totalSamples: channelData.length
        };
    }

    // Calculate RMS (Root Mean Square) for volume analysis
    calculateRMS(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }

    // Analyze volume consistency
    calculateVolumeConsistency(audioData) {
        const frameSize = 1024;
        const frameRMS = [];
        
        for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
            const frame = audioData.slice(i, i + frameSize);
            frameRMS.push(this.calculateRMS(frame));
        }
        
        // Calculate standard deviation of RMS values
        const mean = frameRMS.reduce((sum, val) => sum + val, 0) / frameRMS.length;
        const variance = frameRMS.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / frameRMS.length;
        const stdDev = Math.sqrt(variance);
        
        // Lower std dev = more consistent volume
        return { mean, stdDev, consistency: Math.max(0, 1 - (stdDev * 10)) };
    }

    // Basic pitch analysis using autocorrelation
    analyzePitchCharacteristics(audioData, sampleRate) {
        const frameSize = 2048;
        const hopSize = 512;
        const pitches = [];
        
        for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
            const frame = audioData.slice(i, i + frameSize);
            const pitch = this.detectPitch(frame, sampleRate);
            if (pitch > 0) pitches.push(pitch);
        }
        
        if (pitches.length === 0) {
            return { averagePitch: 0, pitchStability: 0.3, pitchRange: 0, pitchCount: 0 };
        }
        
        const averagePitch = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
        const pitchVariance = pitches.reduce((sum, p) => sum + Math.pow(p - averagePitch, 2), 0) / pitches.length;
        const pitchStdDev = Math.sqrt(pitchVariance);
        const pitchRange = Math.max(...pitches) - Math.min(...pitches);
        
        return {
            averagePitch,
            pitchStability: Math.max(0, 1 - (pitchStdDev / (averagePitch || 1))), // Lower std dev = more stable
            pitchRange,
            pitchVariation: pitchStdDev,
            pitchCount: pitches.length
        };
    }

    // Simple pitch detection using autocorrelation
    detectPitch(buffer, sampleRate) {
        // Autocorrelation-based pitch detection
        const MIN_FREQ = 80;  // Lowest singing frequency
        const MAX_FREQ = 1000; // Highest fundamental frequency for singing
        
        const minPeriod = Math.floor(sampleRate / MAX_FREQ);
        const maxPeriod = Math.floor(sampleRate / MIN_FREQ);
        
        let maxCorrelation = 0;
        let bestPeriod = 0;
        
        // Simple autocorrelation
        for (let period = minPeriod; period <= maxPeriod && period < buffer.length / 2; period++) {
            let correlation = 0;
            for (let i = 0; i < buffer.length - period; i++) {
                correlation += buffer[i] * buffer[i + period];
            }
            
            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
                bestPeriod = period;
            }
        }
        
        return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
    }

    // Analyze spectral characteristics (tone quality)
    analyzeSpectralCharacteristics(audioData, sampleRate) {
        // Basic spectral analysis using simplified FFT approach
        const fftSize = 1024;
        const frameCount = Math.floor(audioData.length / fftSize);
        let totalSpectralCentroid = 0;
        let totalBrightness = 0;
        let spectralEnergy = 0;
        
        for (let f = 0; f < frameCount; f++) {
            const frame = audioData.slice(f * fftSize, (f + 1) * fftSize);
            const spectrum = this.computeSimpleSpectrum(frame);
            
            const centroid = this.calculateSpectralCentroid(spectrum, sampleRate);
            const brightness = this.calculateBrightness(spectrum);
            const energy = spectrum.reduce((sum, val) => sum + val, 0);
            
            totalSpectralCentroid += centroid;
            totalBrightness += brightness;
            spectralEnergy += energy;
        }
        
        return {
            spectralCentroid: totalSpectralCentroid / frameCount,
            brightness: totalBrightness / frameCount,
            spectralEnergy: spectralEnergy / frameCount,
            harmonicRichness: Math.min(1, (totalSpectralCentroid / frameCount) / 2000)
        };
    }

    // Simplified spectrum computation
    computeSimpleSpectrum(buffer) {
        // This is a simplified version for basic spectral analysis
        const N = buffer.length;
        const spectrum = new Array(N / 2).fill(0);
        
        // Simple magnitude calculation by frequency bands
        for (let k = 0; k < N / 2; k += 4) {
            let magnitude = 0;
            for (let n = 0; n < N; n += 8) {
                if (n < buffer.length) {
                    magnitude += Math.abs(buffer[n]) * Math.cos(2 * Math.PI * k * n / N);
                }
            }
            spectrum[k] = Math.abs(magnitude);
        }
        
        return spectrum;
    }

    // Calculate spectral centroid (brightness measure)
    calculateSpectralCentroid(spectrum, sampleRate) {
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            const frequency = (i * sampleRate) / (2 * spectrum.length);
            weightedSum += frequency * spectrum[i];
            magnitudeSum += spectrum[i];
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }

    // Calculate brightness (high frequency content)
    calculateBrightness(spectrum) {
        const total = spectrum.reduce((sum, val) => sum + val, 0);
        if (total === 0) return 0;
        
        const highFreqStart = Math.floor(spectrum.length * 0.6); // Above 60% of Nyquist
        const highFreqSum = spectrum.slice(highFreqStart).reduce((sum, val) => sum + val, 0);
        
        return highFreqSum / total;
    }

    // Analyze temporal characteristics
    analyzeTemporalCharacteristics(audioData, sampleRate) {
        const frameSize = 1024;
        const energyFrames = [];
        
        // Calculate energy for each frame
        for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
            const frame = audioData.slice(i, i + frameSize);
            energyFrames.push(this.calculateRMS(frame));
        }
        
        // Detect note onsets (sudden energy increases)
        const onsets = this.detectOnsets(energyFrames);
        
        return {
            noteOnsets: onsets.length,
            rhythmRegularity: this.calculateRhythmRegularity(onsets),
            energyVariation: this.calculateEnergyVariation(energyFrames),
            averageEnergy: energyFrames.reduce((sum, val) => sum + val, 0) / energyFrames.length
        };
    }

    // Simple onset detection
    detectOnsets(energyFrames) {
        const onsets = [];
        const threshold = 1.5; // Energy must increase by 50%
        
        for (let i = 1; i < energyFrames.length; i++) {
            if (energyFrames[i] > energyFrames[i - 1] * threshold && energyFrames[i] > 0.01) {
                onsets.push(i);
            }
        }
        
        return onsets;
    }

    // Calculate rhythm regularity
    calculateRhythmRegularity(onsets) {
        if (onsets.length < 2) return 0.5;
        
        const intervals = [];
        for (let i = 1; i < onsets.length; i++) {
            intervals.push(onsets[i] - onsets[i - 1]);
        }
        
        const meanInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - meanInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Lower standard deviation = more regular rhythm
        return Math.max(0, 1 - (stdDev / (meanInterval || 1)));
    }

    // Calculate energy variation
    calculateEnergyVariation(energyFrames) {
        const mean = energyFrames.reduce((sum, val) => sum + val, 0) / energyFrames.length;
        if (mean === 0) return 0;
        
        const variance = energyFrames.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / energyFrames.length;
        return Math.sqrt(variance) / mean; // Coefficient of variation
    }

    // CORRECTED: Strict silence detection and proper scoring (never exceeds 10/10)
    generateComprehensiveAnalysisResults(features) {
        console.log('🎯 Generating scores from comprehensive audio features:', features);
        
        // STRICTER SILENCE/NOISE DETECTION
        const hasActualSinging = this.detectActualSinging(features);
        
        if (!hasActualSinging) {
            console.log('❌ No actual singing detected - returning near-zero scores');
            return this.generateSilenceScores();
        }
        
        console.log('✅ Actual singing detected - generating fair scores');
        
        // CORRECTED SCORING - Apply bonus BEFORE Math.min to prevent scores > 10
        const fairBonus = 1.5; // Gentle bonus for actual singing
        
        // Pitch Accuracy: Based on pitch detection and stability
        const pitchAccuracy = Math.min(10, Math.max(1,
            (features.pitchAnalysis.averagePitch > 0 ? 
            (features.pitchAnalysis.pitchStability * 7 + 
             (features.pitchAnalysis.pitchCount > 10 ? 2 : 0) + 1) : 2) + fairBonus
        ));
        
        // Tone Quality: Based on spectral characteristics and harmonics
        const toneQuality = Math.min(10, Math.max(1,
            ((features.spectralFeatures.harmonicRichness * 4) + 
            (features.spectralFeatures.brightness * 3) +
            (features.overallEnergy > 0.01 ? 2 : 0) + 1) + fairBonus
        ));
        
        // Rhythm & Timing: Based on onset detection and regularity
        const rhythmTiming = Math.min(10, Math.max(1,
            ((features.temporalFeatures.rhythmRegularity * 5) + 
            (features.temporalFeatures.noteOnsets > 0 ? 3 : 1) + 
            (features.pitchAnalysis.pitchCount > 5 ? 1 : 0) + 1) + fairBonus
        ));
        
        // Pitch Stability: Directly from pitch analysis
        const pitchStability = Math.min(10, Math.max(1,
            (features.pitchAnalysis.pitchStability * 8 + 1) + fairBonus
        ));
        
        // Vocal Clarity: Based on energy, spectral clarity, and consistency
        const vocalClarity = Math.min(10, Math.max(1,
            ((features.overallEnergy > 0.02 ? 4 : 1) + 
            (features.volumeConsistency.consistency * 3) +
            (features.spectralFeatures.spectralCentroid > 800 ? 2 : 1) + 1) + fairBonus
        ));
        
        // Dynamic Range: Based on energy variation (some variation is good)
        const dynamicRange = Math.min(10, Math.max(1,
            (6 - Math.abs(features.temporalFeatures.energyVariation - 0.3) * 10 + 2) + fairBonus
        ));
        
        // Breath Control: Based on volume consistency and energy stability
        const breathControl = Math.min(10, Math.max(1,
            (features.volumeConsistency.consistency * 6 + 
            (features.temporalFeatures.averageEnergy > 0.01 ? 2 : 0) + 1) + fairBonus
        ));
        
        // Note Transitions: Based on pitch stability and spectral consistency
        const noteTransitions = Math.min(10, Math.max(1,
            ((features.pitchAnalysis.pitchStability * 4) + 
            (features.temporalFeatures.rhythmRegularity * 3) +
            (features.spectralFeatures.harmonicRichness * 2) + 1) + fairBonus
        ));
        
        // Vibrato Control: Based on controlled pitch variation
        const vibratoControl = Math.min(10, Math.max(1,
            (features.pitchAnalysis.averagePitch > 0 ?
            Math.max(1, 7 - Math.abs(features.pitchAnalysis.pitchVariation / (features.pitchAnalysis.averagePitch || 100) - 0.02) * 100) : 5) + fairBonus
        ));
        
        // Expression: Based on dynamic range and harmonic variation
        const expression = Math.min(10, Math.max(1,
            ((features.temporalFeatures.energyVariation * 4) + 
            (features.spectralFeatures.brightness * 3) +
            (features.pitchAnalysis.pitchRange > 50 ? 2 : 0) + 1) + fairBonus
        ));

        return {
            pitchAccuracy: Math.round(pitchAccuracy * 10) / 10,
            toneQuality: Math.round(toneQuality * 10) / 10,
            rhythmTiming: Math.round(rhythmTiming * 10) / 10,
            pitchStability: Math.round(pitchStability * 10) / 10,
            vocalClarity: Math.round(vocalClarity * 10) / 10,
            dynamicRange: Math.round(dynamicRange * 10) / 10,
            breathControl: Math.round(breathControl * 10) / 10,
            noteTransitions: Math.round(noteTransitions * 10) / 10,
            vibratoControl: Math.round(vibratoControl * 10) / 10,
            expression: Math.round(expression * 10) / 10
        };
    }

    // STRICTER: Detect actual singing vs silence/background noise
    detectActualSinging(features) {
        console.log('🔍 Checking for actual singing vs noise/silence...');
        
        // MUCH STRICTER thresholds
        const hasStrongEnergy = features.overallEnergy > 0.008; // 8x stricter than before
        const hasManyPitches = features.pitchAnalysis.pitchCount > 8; // Must have sustained pitching
        const hasHumanPitch = features.pitchAnalysis.averagePitch > 100 && features.pitchAnalysis.averagePitch < 800;
        const hasGoodSpectral = features.spectralFeatures.spectralCentroid > 400;
        const hasVocalActivity = features.temporalFeatures.noteOnsets > 1;
        const hasPitchStability = features.pitchAnalysis.pitchStability > 0.2; // Some pitch consistency required
        
        console.log('🎵 Strict singing detection:', {
            hasStrongEnergy: `${hasStrongEnergy} (${features.overallEnergy.toFixed(4)})`,
            hasManyPitches: `${hasManyPitches} (${features.pitchAnalysis.pitchCount} pitches)`,
            hasHumanPitch: `${hasHumanPitch} (${features.pitchAnalysis.averagePitch.toFixed(1)}Hz)`,
            hasGoodSpectral: `${hasGoodSpectral} (${features.spectralFeatures.spectralCentroid.toFixed(1)}Hz)`,
            hasVocalActivity: `${hasVocalActivity} (${features.temporalFeatures.noteOnsets} onsets)`,
            hasPitchStability: `${hasPitchStability} (${features.pitchAnalysis.pitchStability.toFixed(3)})`
        });
        
        // Need at least 4 of these 6 indicators for actual singing
        const indicators = [hasStrongEnergy, hasManyPitches, hasHumanPitch, hasGoodSpectral, hasVocalActivity, hasPitchStability];
        const positiveIndicators = indicators.filter(Boolean).length;
        
        const isSinging = positiveIndicators >= 4;
        console.log(`🎤 Decision: ${isSinging ? '✅ REAL SINGING' : '❌ SILENCE/NOISE'} (${positiveIndicators}/6 indicators)`);
        
        return isSinging;
    }

    // Near-zero scores for silence/background noise
    generateSilenceScores() {
        console.log('🔇 Generating near-zero scores for silence/noise');
        
        // Very low scores (0.1-0.8 range)
        const lowScore = 0.1 + Math.random() * 0.7;
        
        return {
            pitchAccuracy: Math.round(lowScore * 10) / 10,
            toneQuality: Math.round(lowScore * 10) / 10,
            rhythmTiming: Math.round(lowScore * 10) / 10,
            pitchStability: Math.round(lowScore * 10) / 10,
            vocalClarity: Math.round(lowScore * 10) / 10,
            dynamicRange: Math.round(lowScore * 10) / 10,
            breathControl: Math.round(lowScore * 10) / 10,
            noteTransitions: Math.round(lowScore * 10) / 10,
            vibratoControl: Math.round(lowScore * 10) / 10,
            expression: Math.round(lowScore * 10) / 10
        };
    }

    // Fallback if comprehensive analysis fails
    generateFallbackResults() {
        console.warn('Using fallback basic analysis');
        const baseScore = 4 + Math.random() * 4;
        return {
            pitchAccuracy: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 3)),
            toneQuality: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            rhythmTiming: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 2.5)),
            pitchStability: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            vocalClarity: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            dynamicRange: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 3)),
            breathControl: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 2.5)),
            noteTransitions: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            vibratoControl: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 3)),
            expression: Math.max(1, Math.min(10, baseScore + (Math.random() - 0.5) * 2))
        };
    }

    showResults() {
        console.log('Showing results...');
        this.showScreen('resultsScreen');
        setTimeout(() => {
            this.displayOverallScore();
            this.displayParameterScores();
            this.checkAchievements();
            this.animateResults();
        }, 100);
    }

    displayOverallScore() {
        const scores = Object.values(this.analysisResults);
        const weightedScore = scores.reduce((total, score, index) => total + score * this.vocalParameters[index].weight, 0) * 10;
        const overallScore = Math.round(Math.max(0, Math.min(100, weightedScore)));
        const gradeInfo = this.scoreRanges.find(range => overallScore >= range.min && overallScore <= range.max) || this.scoreRanges[this.scoreRanges.length - 1];
        console.log('Overall score:', overallScore, 'Grade:', gradeInfo.grade);

        // Animate score
        this.animateValue(document.getElementById('overallScore'), 0, overallScore, 2000);
        document.getElementById('gradeDisplay').textContent = gradeInfo.grade;
        document.getElementById('gradeTitle').textContent = gradeInfo.title;
        document.getElementById('gradeMessage').textContent = gradeInfo.message;

        // Update score circle
        setTimeout(() => {
            const scoreCircle = document.querySelector('.score-circle');
            const percentage = overallScore;
            scoreCircle.style.background = `conic-gradient(var(--color-primary) ${percentage * 3.6}deg, var(--color-secondary) 0deg)`;
        }, 500);
    }

    displayParameterScores() {
        const parametersGrid = document.getElementById('parametersGrid');
        parametersGrid.innerHTML = '';

        const scores = Object.values(this.analysisResults);
        this.vocalParameters.forEach((param, index) => {
            const score = scores[index];
            const parameterItem = this.createParameterItem(param, score, index);
            parametersGrid.appendChild(parameterItem);
        });
    }

    createParameterItem(param, score, index) {
        const item = document.createElement('div');
        item.className = 'parameter-item';
        item.addEventListener('click', () => this.showParameterDetails(param, score));

        // Color based on score
        let fillColor = '#dc2626'; // Red for low scores
        if (score > 7) fillColor = '#16a34a'; // Green for high scores
        else if (score > 5) fillColor = '#d97706'; // Orange for medium scores

        item.innerHTML = `
            <div class="parameter-icon" style="color: ${fillColor}">${param.icon}</div>
            <div class="parameter-score" style="color: ${fillColor}">${score.toFixed(1)}/10</div>
            <div class="parameter-name">${param.name}</div>
        `;

        return item;
    }

    // SAVE RESULTS METHOD WITH DUPLICATE PREVENTION
    async saveResults() {
        console.log('Save Results clicked - attempting to save');
        
        // Find the save button to prevent multiple saves
        const saveButton = document.getElementById('confirmSave') || document.querySelector('button[onclick*="save"]') || document.querySelector('.save-btn');
        
        // Prevent multiple saves
        if (saveButton && saveButton.disabled) {
            console.log('Save already in progress, ignoring click');
            return;
        }
        
        // Disable button and show loading state
        if (saveButton) {
            saveButton.disabled = true;
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Saving...';
            
            // Re-enable button after operation completes
            const resetButton = () => {
                saveButton.disabled = false;
                saveButton.textContent = originalText;
            };
            
            // Auto-reset after 10 seconds as failsafe
            setTimeout(resetButton, 10000);
        }
        
        try {
            // FIXED: Use correct phone input ID
            const phoneInput = document.getElementById('phoneNumber');
            if (!phoneInput) {
                console.error('Phone input field with ID "phoneNumber" not found');
                alert('Phone input field not found. Please try again.');
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = 'Save Progress';
                }
                return;
            }

            const phoneNumber = phoneInput.value.trim();
            if (!phoneNumber) {
                alert('Please enter a phone number to save your results.');
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = 'Save Progress';
                }
                return;
            }

            // Calculate overall score
            const scores = Object.values(this.analysisResults);
            const overallScore = Math.round(scores.reduce((total, score, index) => total + score * this.vocalParameters[index].weight, 0) * 10);
            
            // Prepare parameter scores object
            const parameterScores = {};
            this.vocalParameters.forEach((param, index) => {
                parameterScores[param.name] = scores[index];
            });

            // Convert audio data to Base64 for upload
            let audioDataUrl = null;
            if (this.recordingData && this.recordingData.length > 0) {
                try {
                    const audioBlob = new Blob(this.recordingData, { type: 'audio/webm' });
                    audioDataUrl = await this.convertBlobToBase64(audioBlob);
                    console.log('Audio converted to Base64, size:', audioDataUrl.length);
                } catch (audioError) {
                    console.error('Failed to convert audio to Base64:', audioError);
                    // Continue without audio - don't fail the entire save
                }
            }

            const payload = {
                phoneNumber,
                overallScore,
                parameterScores,
                audioDataUrl,
                sessionId: this.generateSessionId(),
                timestamp: new Date().toISOString()
            };

            console.log('Sending save request with payload:', {
                ...payload,
                audioDataUrl: audioDataUrl ? `[Base64 data ${audioDataUrl.length} chars]` : null
            });

            const response = await fetch('/api/save-score', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.JSON.stringify(payload)
            });

            console.log('Save response status:', response.status);
            const result = await response.json();
            console.log('Save response data:', result);

            if (response.ok && result.success) {
                alert('Results saved successfully! 🎉');
                this.userPhone = phoneNumber;
                localStorage.setItem('vocalmaster_phone', phoneNumber);
                this.hideSaveModal();
                
                // Add to user sessions for achievements
                this.userSessions.push('assessment_' + Date.now());
                this.saveUserSessions();
            } else {
                console.error('Save failed:', result);
                alert(`Failed to save results: ${result.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error('Save Results error:', error);
            alert('An error occurred while saving. Please check your internet connection and try again.');
        } finally {
            // Re-enable button
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Progress';
            }
        }
    }

    // Helper method to convert blob to base64
    convertBlobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
    }

    checkAchievements() {
        const scores = Object.values(this.analysisResults);
        const overallScore = Math.round(scores.reduce((total, score, index) => total + score * this.vocalParameters[index].weight, 0) * 10);
        
        if (!this.userSessions.includes('firstSong') && overallScore > 0) {
            this.userSessions.push('firstSong');
            this.showAchievement('First Song');
            this.saveUserSessions();
        }
        if (!this.userSessions.includes('perfectPitch') && this.analysisResults.pitchAccuracy >= 9.5) {
            this.userSessions.push('perfectPitch');
            this.showAchievement('Perfect Pitch');
            this.saveUserSessions();
        }
        if (!this.userSessions.includes('smoothOperator') && this.analysisResults.noteTransitions >= 9) {
            this.userSessions.push('smoothOperator');
            this.showAchievement('Smooth Operator');
            this.saveUserSessions();
        }
        if (!this.userSessions.includes('breathMaster') && this.analysisResults.breathControl >= 8.5) {
            this.userSessions.push('breathMaster');
            this.showAchievement('Breath Master');
            this.saveUserSessions();
        }
    }

    showAchievement(name) {
        const achievement = this.achievements.find(a => a.name === name);
        if (!achievement) return;
        
        // Create achievement notification
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-text">
                <div class="achievement-title">Achievement Unlocked!</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.description}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    saveUserSessions() {
        localStorage.setItem('vocalmaster_sessions', JSON.stringify(this.userSessions));
    }

    playRecording() {
        if (this.audioElement) {
            console.log('Playing recording...');
            this.audioElement.play().catch(e => console.error('Play failed:', e));
        }
    }

    async shareResults() {
        const scores = Object.values(this.analysisResults);
        const overallScore = Math.round(scores.reduce((total, score, index) => total + score * this.vocalParameters[index].weight, 0) * 10);
        const gradeInfo = this.scoreRanges.find(range => overallScore >= range.min && overallScore <= range.max);
        
        const shareText = `🎤 I just scored ${overallScore}/100 (${gradeInfo.grade}) on VocalMaster! ${gradeInfo.title} Check out this AI singing assessment app!`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My VocalMaster Score',
                    text: shareText,
                    url: window.location.href
                });
                console.log('Share successful');
            } catch (error) {
                console.log('Share cancelled or failed:', error);
                this.fallbackShare(shareText);
            }
        } else {
            this.fallbackShare(shareText);
        }
    }

    fallbackShare(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Score copied to clipboard! Share it with your friends!');
            }).catch(() => {
                this.showShareModal(text);
            });
        } else {
            this.showShareModal(text);
        }
    }

    showShareModal(text) {
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-content">
                <h3>Share Your Score</h3>
                <textarea readonly>${text}</textarea>
                <button onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    resetToRecording() {
        this.analysisResults = null;
        this.recordingData = [];
        this.audioElement = null;
        this.showScreen('recordingScreen');
        this.resetRecordingUI();
    }

    resetRecordingUI() {
        document.getElementById('timer').textContent = '00:00';
        document.getElementById('timerProgressBar').style.width = '0%';
        document.querySelector('.waveform-placeholder').style.display = 'block';
        this.canvas.style.display = 'none';
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('screen--active');
        });
        document.getElementById(screenId).classList.add('screen--active');
    }

    showSaveModal() {
        const modal = document.getElementById('saveModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Pre-fill phone number if previously saved
            const phoneInput = document.getElementById('phoneNumber');
            if (phoneInput && this.userPhone) {
                phoneInput.value = this.userPhone;
            }
        }
    }

    hideSaveModal() {
        const modal = document.getElementById('saveModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showParameterDetails(param, score) {
        const modal = document.getElementById('parameterModal');
        if (modal) {
            document.getElementById('parameterName').textContent = param.name;
            document.getElementById('parameterIcon').textContent = param.icon;
            document.getElementById('parameterScore').textContent = `${score.toFixed(1)}/10`;
            document.getElementById('parameterDescription').textContent = param.description;
            modal.style.display = 'block';
        }
    }

    hideParameterModal() {
        const modal = document.getElementById('parameterModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    animateValue(element, start, end, duration) {
        let startTime = null;
        const animate = (currentTime) => {
            if (startTime === null) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value;
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    animateResults() {
        const items = document.querySelectorAll('.parameter-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(20px)';
                item.style.transition = 'all 0.3s ease';
                
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, 50);
            }, index * 100);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing VocalMaster...');
    window.vocalMaster = new VocalMaster();
});