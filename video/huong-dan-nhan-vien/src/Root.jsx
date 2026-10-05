import React from 'react';
import { Composition } from 'remotion';
import { Video } from './Video.jsx';
import { TOTAL, FPS, W, H } from './timeline.js';

export const Root = () => (
  <Composition id="HuongDan" component={Video} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
