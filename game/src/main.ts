import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config/config';
import { BootScene } from './scenes/BootScene';
import { GameScene, TRANSPARENT } from './scenes/GameScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  transparent: TRANSPARENT,
  backgroundColor: TRANSPARENT ? undefined : '#0c1024',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: 'high-performance' },
  disableContextMenu: true,
  scene: [BootScene, GameScene],
});

// Cu ?debug=1, jocul e accesibil din consola browserului (măsurători, teste).
if (new URLSearchParams(location.search).get('debug') === '1') (window as unknown as { game: Phaser.Game }).game = game;
