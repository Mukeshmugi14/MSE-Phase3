const { FACSAnalyser } = require('./lib/facs-analyser');

const analyser = new FACSAnalyser();
analyser.addFrame({
  timestamp: Date.now(),
  landmarks: [],
  emotions: { neutral: 1, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 },
  affect_range_score: 0,
  congruence_flag: false
});

console.log(JSON.stringify(analyser.getSummary(), null, 2));
