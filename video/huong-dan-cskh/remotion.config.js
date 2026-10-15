import { Config } from '@remotion/cli/config';
// Môi trường không tải được Chrome của Remotion -> dùng headless shell có sẵn (nếu có)
import fs from 'fs';
const shell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (fs.existsSync(shell)) Config.setBrowserExecutable(shell);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
