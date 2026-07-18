/**
 * 音響制御モジュール
 */
const PuzzleAudio = {
  sounds: {},

  init() {
    this.sounds.snap = new Audio('sounds/snap.mp3');
    this.sounds.sausage = new Audio('sounds/sausage.mp3');
  },

  play(name) {
    if (this.sounds[name]) {
      this.sounds[name].currentTime = 0;
      this.sounds[name].play().catch(err => {
        console.warn('Audio play prevented:', err);
      });
    }
  }
};