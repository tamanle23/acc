import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type { StoryConfig, SceneConfig, PlatformPreset, CaptionPreset, SubtitleMode } from './src/types';
import { transcribeAudio } from './src/whisper';
import { generateAudioFromTTS } from './src/tts';
import { PLATFORM_PRESETS } from './src/platforms';
import { PRESETS as CAPTION_PRESETS } from './src/styles';

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function getBaseNameWithoutExt(filename: string): string {
  return path.parse(filename).name.toLowerCase();
}

/**
 * Thu thập tất cả các file ảnh và âm thanh trong thư mục gốc và các thư mục con (e.g. ./voiceover, ./images, ./audio)
 */
function collectMediaFiles(baseDir: string): { imageFiles: string[]; audioFiles: string[] } {
  const imageFiles: string[] = [];
  const audioFiles: string[] = [];

  function scanDir(dir: string, relativePrefix = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = relativePrefix ? path.posix.join(relativePrefix, entry.name) : entry.name;
      const fullPath = path.join(dir, entry.name);

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          imageFiles.push(relPath.replace(/\\/g, '/'));
        } else if (AUDIO_EXTENSIONS.has(ext)) {
          audioFiles.push(relPath.replace(/\\/g, '/'));
        }
      } else if (entry.isDirectory()) {
        const nameLower = entry.name.toLowerCase();
        const isAudioDir = ['voiceover', 'voiceovers', 'audio', 'audios', 'voices', 'sound', 'sounds'].includes(nameLower);
        const isImageDir = ['images', 'image', 'img', 'scenes', 'scene', 'pictures', 'pics'].includes(nameLower);

        // Quét sâu vào các thư mục media con (voiceover/, images/, audio/...) hoặc cấp 1
        if ((isAudioDir || isImageDir || !relativePrefix) && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          scanDir(fullPath, relPath);
        }
      }
    }
  }

  scanDir(baseDir);
  return {
    imageFiles: imageFiles.sort(naturalSort),
    audioFiles: audioFiles.sort(naturalSort),
  };
}

/**
 * Ghép cặp ảnh và audio thông minh:
 * 1. Ưu tiên trùng tên gốc (VD: 01.png đi với voiceover/01.mp3, intro.jpg đi với audio/intro.wav)
 * 2. Nếu không trùng tên, ghép theo thứ tự sắp xếp tự nhiên (1, 2, 3...)
 */
function pairImagesAndAudios(
  imageFiles: string[],
  audioFiles: string[]
): { image: string; audio: string }[] {
  const pairs: { image: string; audio: string }[] = [];
  const usedImages = new Set<string>();
  const unmappedAudios: string[] = [];

  // Tạo map tên gốc của ảnh (VD: "01" -> "images/01.jpg" hoặc "01.jpg")
  const imageBaseMap = new Map<string, string>();
  for (const img of imageFiles) {
    imageBaseMap.set(getBaseNameWithoutExt(img), img);
  }

  // Bước 1: Ghép cặp theo tên giống nhau
  for (const audio of audioFiles) {
    const audioBase = getBaseNameWithoutExt(audio);
    if (imageBaseMap.has(audioBase)) {
      const matchedImage = imageBaseMap.get(audioBase)!;
      pairs.push({ image: matchedImage, audio });
      usedImages.add(matchedImage);
    } else {
      unmappedAudios.push(audio);
    }
  }

  // Bước 2: Với các audio chưa ghép được, lấy các ảnh còn lại theo thứ tự
  const remainingImages = imageFiles.filter((img) => !usedImages.has(img));

  for (let i = 0; i < unmappedAudios.length; i++) {
    const audio = unmappedAudios[i];
    const image = remainingImages[i] || imageFiles[i % imageFiles.length] || 'scene.jpg';
    pairs.push({ image, audio });
  }

  return pairs;
}

interface ReferenceScriptCache {
  globalLines?: string[];
  globalJson?: string[];
}

/**
 * Tự động tìm và nạp kịch bản toàn cục nếu có (script.txt, story.txt, transcript.txt, script.json...)
 */
function loadGlobalScripts(baseDir: string): ReferenceScriptCache {
  const cache: ReferenceScriptCache = {};

  // 1. Kiểm tra JSON files
  const jsonNames = [
    'script.json',
    'story.json',
    'transcript.json',
    'scripts.json',
    'kịch_bản.json',
    'kich_ban.json',
  ];
  for (const name of jsonNames) {
    const p = path.join(baseDir, name);
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (Array.isArray(data)) {
          cache.globalJson = data
            .map((item) => {
              if (typeof item === 'string') return item.trim();
              if (typeof item === 'object' && item !== null) {
                return (
                  item.text ||
                  item.script ||
                  item.content ||
                  item.caption ||
                  item.voiceover ||
                  ''
                ).trim();
              }
              return '';
            })
            .filter((s) => s.length > 0);
          break;
        }
      } catch {}
    }
  }

  // 2. Kiểm tra TXT files (mỗi dòng hoặc mỗi đoạn ứng với 1 slide)
  const txtNames = [
    'script.txt',
    'story.txt',
    'transcript.txt',
    'scripts.txt',
    'kịch_bản.txt',
    'kich_ban.txt',
    'noidung.txt',
    'noi_dung.txt',
  ];
  for (const name of txtNames) {
    const p = path.join(baseDir, name);
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        const lines = content
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('#'));
        if (lines.length > 0) {
          cache.globalLines = lines;
          break;
        }
      } catch {}
    }
  }

  return cache;
}

/**
 * Tìm văn bản kịch bản gốc tương ứng cho từng slide:
 * 1. File .txt / .script cùng thư mục với audio (VD: voiceover/01.txt, voiceover/01.mp3.txt)
 * 2. File .txt ở thư mục gốc có cùng tên audio hoặc ảnh (VD: 01.txt, voiceover1.txt, scene1.txt)
 * 3. File .txt theo số thứ tự slide (VD: 1.txt, slide1.txt, scene1.txt)
 * 4. Dòng/mục tương ứng trong file script.json hoặc script.txt toàn cục
 */
function findReferenceScript(
  audioName: string,
  imageName: string,
  slideIndex: number,
  baseDir: string,
  cache: ReferenceScriptCache
): { scriptText: string; source: string } | null {
  const audioBase = path.parse(audioName).name;
  const imageBase = path.parse(imageName).name;
  const audioDir = path.dirname(
    path.isAbsolute(audioName) ? audioName : path.join(baseDir, audioName)
  );

  // Danh sách các ứng viên file script riêng lẻ
  const candidates = [
    // Cùng thư mục với file audio
    path.join(audioDir, `${audioBase}.txt`),
    path.join(audioDir, `${path.basename(audioName)}.txt`),
    path.join(audioDir, `${audioBase}.script`),
    // Thư mục gốc story
    path.join(baseDir, `${audioBase}.txt`),
    path.join(baseDir, `${imageBase}.txt`),
    path.join(baseDir, `${slideIndex + 1}.txt`),
    path.join(baseDir, `slide${slideIndex + 1}.txt`),
    path.join(baseDir, `scene${slideIndex + 1}.txt`),
    path.join(baseDir, `voiceover${slideIndex + 1}.txt`),
    path.join(baseDir, `audio${slideIndex + 1}.txt`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const text = fs.readFileSync(candidate, 'utf-8').trim();
        if (text.length > 0) {
          return { scriptText: text, source: path.relative(baseDir, candidate) };
        }
      } catch {}
    }
  }

  // File JSON toàn cục
  if (cache.globalJson && cache.globalJson[slideIndex]) {
    return {
      scriptText: cache.globalJson[slideIndex],
      source: `script.json [mục ${slideIndex + 1}]`,
    };
  }

  // File TXT toàn cục (theo thứ tự dòng)
  if (cache.globalLines && cache.globalLines[slideIndex]) {
    return {
      scriptText: cache.globalLines[slideIndex],
      source: `script.txt [dòng ${slideIndex + 1}]`,
    };
  }

  return null;
}

const PLATFORM_MENU: { label: string; preset: PlatformPreset }[] = [
  { label: 'TikTok / Shorts / Reels (1080x1920 - 9:16 dọc)', preset: 'tiktok' },
  { label: 'YouTube Full HD (1920x1080 - 16:9 ngang)', preset: 'youtube' },
  { label: 'YouTube 4K (3840x2160 - 16:9 60fps)', preset: 'youtube-4k' },
  { label: 'Facebook / Instagram Post (1080x1350 - 4:5 dọc lửng)', preset: 'facebook' },
  { label: 'Instagram Feed (1080x1080 - 1:1 vuông)', preset: 'instagram' },
  { label: 'Web (1280x720 - tải nhanh, nhẹ)', preset: 'web' },
  { label: 'Mobile (720x1280 - tiết kiệm 3G/4G)', preset: 'mobile' },
];

const CAPTION_MENU: { label: string; preset: CaptionPreset }[] = [
  { label: 'TikTok (Vàng neon, viền đen dày, nổi bật)', preset: 'tiktok' },
  { label: 'Classic (Trắng, viền đen mỏng, chuẩn truyền hình)', preset: 'classic' },
  { label: 'Cinematic (Trắng, Times New Roman, bóng mờ điện ảnh)', preset: 'cinematic' },
  { label: 'Vlog (Trắng, có hộp đen mờ bao quanh)', preset: 'vlog' },
  { label: 'Neon Glow (Xanh Cyan, viền tím, phát sáng gaming/cyberpunk)', preset: 'neon-glow' },
  { label: 'Bold Retro (Cam rực, viền trắng, phong cách comics/pop-art)', preset: 'bold-retro' },
  { label: 'Minimal Clean (Trắng tinh, viền siêu mỏng, tối giản)', preset: 'minimal-clean' },
  { label: 'Karaoke (Xanh Lime, viền xanh rêu, highlight từng từ)', preset: 'karaoke' },
  { label: 'News Banner (Trắng, hộp nền xanh Navy thời sự)', preset: 'news-banner' },
  { label: 'Retro Typewriter (Màu ngà, máy đánh chữ cổ điển)', preset: 'retro-typewriter' },
];

async function main() {
  console.log('=== Storyteller Auto-Config & Whisper Transcriber ===\n');

  let targetDir = process.argv.slice(2)[0];

  if (!targetDir) {
    targetDir = await askQuestion('Nhập đường dẫn thư mục story: ');
  }

  if (!targetDir || targetDir.trim() === '') {
    console.error('Lỗi: Bạn chưa cung cấp đường dẫn thư mục.');
    process.exit(1);
  }

  targetDir = targetDir.trim().replace(/^["']|["']$/g, '');
  const absoluteDir = path.resolve(targetDir);

  if (!fs.existsSync(absoluteDir)) {
    console.error(`Lỗi: Không tìm thấy thư mục: ${absoluteDir}`);
    process.exit(1);
  }

  const configPath = path.join(absoluteDir, 'story-config.json');
  let prevConfig: StoryConfig | null = null;
  let shouldMerge = false;

  if (fs.existsSync(configPath)) {
    try {
      prevConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (prevConfig?.settings) {
        console.log('⚡ Phát hiện file story-config.json đã có sẵn trong thư mục.');
        const mergeAns = await askQuestion(
          '-> Bạn muốn: [1] Giữ lại & Merge cấu hình cũ (mặc định), hay [2] Tạo mới cấu hình hoàn toàn? (1/2): '
        );
        shouldMerge = mergeAns.trim() !== '2';
      }
    } catch {}
  }

  let selectedPlatform: PlatformPreset = 'tiktok';
  let selectedCaptionPreset: CaptionPreset = 'tiktok';
  let selectedSubtitleMode: SubtitleMode = 'burn';
  
  let storyName = path.basename(absoluteDir);
  let storyDesc = '';

  if (!shouldMerge) {
    console.log('\n--- THÔNG TIN VIDEO ---');
    const nameAns = await askQuestion(`Nhập tên video (Mặc định: ${storyName}): `);
    if (nameAns.trim()) storyName = nameAns.trim();
    
    const descAns = await askQuestion(`Nhập mô tả video (Tùy chọn): `);
    storyDesc = descAns.trim();

    // 1. Chọn Platform Preset
    console.log('\n--- CHỌN NỀN TẢNG XUẤT VIDEO (Platform Preset) ---');
    PLATFORM_MENU.forEach((item, idx) => {
      console.log(`  [${idx + 1}] ${item.label}${idx === 0 ? ' [Mặc định]' : ''}`);
    });
    const platformAns = await askQuestion('-> Chọn số (1-7) [mặc định: 1]: ');
    const platformIdx = parseInt(platformAns.trim(), 10) - 1;
    if (!isNaN(platformIdx) && platformIdx >= 0 && platformIdx < PLATFORM_MENU.length) {
      selectedPlatform = PLATFORM_MENU[platformIdx].preset;
    }

    // 2. Chọn Caption Preset
    console.log('\n--- CHỌN PHONG CÁCH PHỤ ĐỀ (Caption Style Preset) ---');
    CAPTION_MENU.forEach((item, idx) => {
      console.log(`  [${idx + 1}] ${item.label}${idx === 0 ? ' [Mặc định]' : ''}`);
    });
    const captionAns = await askQuestion('-> Chọn số (1-10) [mặc định: 1]: ');
    const captionIdx = parseInt(captionAns.trim(), 10) - 1;
    if (!isNaN(captionIdx) && captionIdx >= 0 && captionIdx < CAPTION_MENU.length) {
      selectedCaptionPreset = CAPTION_MENU[captionIdx].preset;
    }

    // 3. Chọn Subtitle Mode
    console.log('\n--- CHỌN CHẾ ĐỘ PHỤ ĐỀ (Subtitle Mode) ---');
    console.log('  [1] Hardsub (Khắc trực tiếp vào video, chuẩn TikTok/Reels/Shorts/Web) [Mặc định]');
    console.log('  [2] Softsub (Mux thành Track Subtitle riêng cho MKV/MP4, bật/tắt được)');
    const subModeAns = await askQuestion('-> Chọn số (1/2) [mặc định: 1]: ');
    if (subModeAns.trim() === '2') {
      selectedSubtitleMode = 'soft';
    }
  }

  // 3a. Chọn Karaoke Highlight Style
  let wordsPerPhrase = 6;
  let highlightPreset: any = 'scale-color';
  let highlightColor = '#00FFFF';

  if (!shouldMerge) {
    console.log('\n--- HIỆU ỨNG KARAOKE PHỤ ĐỀ (Highlight) ---');
    const karAns = await askQuestion('Bạn có muốn bật hiệu ứng Highlight từng từ khi đọc không? (Y/n) [mặc định: Y]: ');
    if (karAns.trim().toLowerCase() !== 'n') {
      const wAns = await askQuestion('-> Số chữ tối đa trên một dòng (Mặc định: 6): ');
      if (parseInt(wAns.trim(), 10) > 0) wordsPerPhrase = parseInt(wAns.trim(), 10);

      console.log('\nChọn hiệu ứng Highlight:');
      console.log('  [1] Phóng to + Đổi màu (Scale & Color) [Mặc định]');
      console.log('  [2] Chỉ đổi màu (Color only)');
      console.log('  [3] Phát sáng (Glow + Scale)');
      console.log('  [4] Chỉ phóng to (Scale only)');
      const hlAns = await askQuestion('-> Chọn số (1-4) [mặc định: 1]: ');
      if (hlAns.trim() === '2') highlightPreset = 'color';
      else if (hlAns.trim() === '3') highlightPreset = 'glow';
      else if (hlAns.trim() === '4') highlightPreset = 'scale';

      if (['1', '2', '3'].includes(hlAns.trim()) || hlAns.trim() === '') {
        const cAns = await askQuestion('-> Nhập mã màu Hex cho Highlight (Mặc định: #00FFFF - Vàng Neon): ');
        if (cAns.trim()) highlightColor = cAns.trim();
      }
    } else {
      highlightPreset = 'none';
      wordsPerPhrase = 1; // Default to old word-by-word or full phrase without highlight
    }
  }

  // 3b. Chọn Transitions
  let enableTransitions = false;
  let transitionType: any = 'fade';
  if (!shouldMerge) {
    console.log('\n--- HIỆU ỨNG CHUYỂN CẢNH (Transitions) ---');
    const transAns = await askQuestion('Bạn có muốn bật hiệu ứng chuyển cảnh mượt mà giữa các ảnh không? (Y/n) [mặc định: Y]: ');
    if (transAns.trim().toLowerCase() !== 'n') {
      enableTransitions = true;
      console.log('  [1] Fade (Mờ dần) [Mặc định]');
      console.log('  [2] Random (Ngẫu nhiên)');
      console.log('  [3] Wipe Left (Vuốt trái)');
      console.log('  [4] Circle Crop (Thu nhỏ vòng tròn)');
      const typeAns = await askQuestion('-> Chọn kiểu (1-4) [mặc định: 1]: ');
      if (typeAns.trim() === '2') transitionType = 'random';
      else if (typeAns.trim() === '3') transitionType = 'wipeleft';
      else if (typeAns.trim() === '4') transitionType = 'circlecrop';
    }
  }

  // 3c. Chọn AI Upscaling
  let enableUpscale = false;
  let upscaleModel: any = 'realesrgan-x4plus';
  if (!shouldMerge) {
    console.log('\n--- AI AUTO-UPSCALE ---');
    const upscaleAns = await askQuestion('Bạn có muốn dùng AI (Real-ESRGAN/UltraSharp) để làm nét ảnh trước khi render không? (y/N) [mặc định: N]: ');
    if (upscaleAns.trim().toLowerCase() === 'y') {
      enableUpscale = true;
      console.log('  [1] Real-ESRGAN (Đa dụng) [Mặc định]');
      console.log('  [2] 4x-UltraSharp (Siêu nét, ảnh thật)');
      console.log('  [3] Real-ESRGAN-Anime (Hoạt hình/2D)');
      const modelAns = await askQuestion('-> Chọn mô hình (1-3) [mặc định: 1]: ');
      if (modelAns.trim() === '2') upscaleModel = '4x-UltraSharp';
      else if (modelAns.trim() === '3') upscaleModel = 'realesrgan-x4plus-anime';
    }
  }

  // 3d. Chọn 3D Depth & Visual Pop-Out
  let enableDepth3D = false;
  let depth3DMode: any = 'frame_breaker';
  let depth3DStyle: any = 'polaroid';
  if (!shouldMerge) {
    console.log('\n--- HIỆU ỨNG TẠO NỔI 3D & CHIỀU SÂU (3D Depth Visuals) ---');
    const depthAns = await askQuestion('Bạn có muốn bật hiệu ứng chiều sâu 3D (Frame-Breaker, Parallax, Sandwich, Wiggle...) không? (y/N) [mặc định: N]: ');
    if (depthAns.trim().toLowerCase() === 'y') {
      enableDepth3D = true;
      console.log('Chọn kỹ thuật 3D:');
      console.log('  [1] Out-of-Bounds (Vượt khung viền 3D) [Mặc định]');
      console.log('  [2] 2.5D Parallax Ken Burns (Camera đa bình diện vi sai)');
      console.log('  [3] Sandwich Volumetric Depth (Chữ & Bụi sáng nằm sau nhân vật)');
      console.log('  [4] AI Depth Map 3D Mesh Displacement (Camera orbital quay quanh vật thể)');
      console.log('  [5] Stereoscopic Wigglegram (Rung lắc thị sai 3D Pop Wobble)');
      const modeAns = await askQuestion('-> Chọn kỹ thuật (1-5) [mặc định: 1]: ');
      if (modeAns.trim() === '2') depth3DMode = 'parallax_25d';
      else if (modeAns.trim() === '3') depth3DMode = 'volumetric_sandwich';
      else if (modeAns.trim() === '4') depth3DMode = 'depth_map_3d';
      else if (modeAns.trim() === '5') depth3DMode = 'wigglegram';
      else {
        depth3DMode = 'frame_breaker';
        console.log('\nChọn phong cách khung:');
        console.log('  [1] Polaroid (Khung ảnh lấy liền viền dày) [Mặc định]');
        console.log('  [2] Card (Thẻ bài bo góc hiện đại)');
        console.log('  [3] Cinema (Khung phim màn ảnh rộng)');
        console.log('  [4] Comic (Khung truyện tranh viền đen)');
        const styleAns = await askQuestion('-> Chọn phong cách khung (1-4) [mặc định: 1]: ');
        if (styleAns.trim() === '2') depth3DStyle = 'card';
        else if (styleAns.trim() === '3') depth3DStyle = 'cinema';
        else if (styleAns.trim() === '4') depth3DStyle = 'comic';
      }
    }
  }

  // 3e. Chọn TTS
  let enableTTS = false;
  let ttsVoice = 'hn-quynhanh';
  if (!shouldMerge) {
    console.log('\n--- LOCAL AI TTS (VieNeu) ---');
    const ttsAns = await askQuestion('Bạn có muốn bật tính năng sinh giọng đọc bằng AI (Local VieNeu-TTS v3 Turbo) không? (y/N) [mặc định: N]: ');
    if (ttsAns.trim().toLowerCase() === 'y') {
      enableTTS = true;
      const voiceAns = await askQuestion('-> Nhập mã giọng đọc (Mặc định: hn-quynhanh): ');
      if (voiceAns.trim()) ttsVoice = voiceAns.trim();
    }
  }

  // Quét toàn bộ ảnh và âm thanh trong thư mục gốc và thư mục con (./voiceover, ./images...)
  const { imageFiles, audioFiles } = collectMediaFiles(absoluteDir);

  console.log(`\nTìm thấy: ${imageFiles.length} file ảnh, ${audioFiles.length} file âm thanh (bao gồm ./voiceover, ./images nếu có).`);

  if (audioFiles.length === 0 && !enableTTS) {
    console.error('Lỗi: Không tìm thấy file âm thanh nào trong thư mục, và TTS chưa được bật.');
    process.exit(1);
  }

  // 4. Hỏi người dùng có muốn chạy Whisper transcribe không
  const transcribePrompt = await askQuestion(
    '\nBạn có muốn chạy Whisper AI để tự động trích xuất phụ đề & timestamps không? (Y/n) [mặc định: Y]: '
  );
  const doTranscribe = transcribePrompt.trim().toLowerCase() !== 'n';

  if (!doTranscribe) {
    console.log('-> Bỏ qua bước Whisper transcription.');
  }

  let filePairs = [];
  if (audioFiles.length === 0 && enableTTS) {
    filePairs = imageFiles.map((img) => ({ image: img, audio: '' }));
  } else {
    filePairs = pairImagesAndAudios(imageFiles, audioFiles);
  }
  const scenes: SceneConfig[] = [];
  const globalScriptCache = loadGlobalScripts(absoluteDir);

  if (globalScriptCache.globalJson) {
    console.log(`⚡ Tìm thấy kịch bản toàn cục: script.json (${globalScriptCache.globalJson.length} đoạn)`);
  } else if (globalScriptCache.globalLines) {
    console.log(`⚡ Tìm thấy kịch bản toàn cục: script.txt (${globalScriptCache.globalLines.length} dòng)`);
  }

  for (let i = 0; i < filePairs.length; i++) {
    const { image: imageName, audio: audioName } = filePairs[i];
    const fullAudioPath = path.isAbsolute(audioName) ? audioName : path.resolve(absoluteDir, audioName);

    console.log(`\n[Scene ${i + 1}/${filePairs.length}] Ghép: ${imageName} <-> ${audioName}`);

    let captions: any[] = [];
    let sceneText: string | undefined = undefined;
    const refScriptInfo = findReferenceScript(audioName, imageName, i, absoluteDir, globalScriptCache);

    if (refScriptInfo) {
      sceneText = refScriptInfo.scriptText;
      console.log(`  -> 🎯 Tìm thấy kịch bản gốc (${refScriptInfo.source}): "${refScriptInfo.scriptText.slice(0, 60)}${refScriptInfo.scriptText.length > 60 ? '...' : ''}"`);
    }

    let finalAudioName = audioName;

    if (!finalAudioName && enableTTS && sceneText) {
      console.log(`  -> Đang sinh âm thanh bằng VieNeu-TTS...`);
      try {
        const generatedAudio = await generateAudioFromTTS(sceneText, { provider: 'vieneu-v3-turbo', voice: ttsVoice, speed: 1.0 }, absoluteDir);
        finalAudioName = path.relative(absoluteDir, generatedAudio).replace(/\\/g, '/');
      } catch (err) {
        console.warn(`  -> Cảnh báo: Lỗi sinh TTS:`, err);
      }
    }

    if (finalAudioName && doTranscribe) {
      const audioToTranscribe = path.isAbsolute(finalAudioName) ? finalAudioName : path.resolve(absoluteDir, finalAudioName);
      if (refScriptInfo) {
        console.log(`  -> Đang căn chỉnh timestamps theo đúng chữ gốc (Script-guided Alignment)...`);
        try {
          captions = await transcribeAudio(audioToTranscribe, 'vietnamese', true, refScriptInfo.scriptText);
          console.log(`  -> ✅ Căn chỉnh thành công ${captions.length} từ theo đúng chính tả kịch bản.`);
        } catch (err: any) {
          console.warn(`  -> Cảnh báo: Lỗi khi căn chỉnh script cho ${finalAudioName}:`, err?.message || err);
        }
      } else {
        console.log(`  -> Đang nhận diện giọng nói tự động bằng Whisper (${finalAudioName})...`);
        try {
          captions = await transcribeAudio(audioToTranscribe, 'vietnamese', true);
          console.log(`  -> Trích xuất được ${captions.length} mốc từ/cụm từ.`);
        } catch (err: any) {
          console.warn(`  -> Cảnh báo: Lỗi khi transcribe ${finalAudioName}:`, err?.message || err);
        }
      }
    } else if (!finalAudioName) {
      console.warn(`  -> Cảnh báo: Không có audio cho scene này!`);
    } else {
      // Giữ lại captions cũ nếu có
      const existingScene = (prevConfig?.scenes || prevConfig?.slides)?.find(
        (s) => s.audio === audioName || s.image === imageName
      );
      if (existingScene && existingScene.captions) {
        captions = existingScene.captions;
        console.log(`  -> Giữ lại ${captions.length} captions đã có từ cấu hình trước.`);
      }
    }

    const sceneObj: SceneConfig = {
      image: imageName,
      captions,
    };
    if (finalAudioName) sceneObj.audio = finalAudioName;
    if (sceneText) sceneObj.text = sceneText;

    scenes.push(sceneObj);
  }

  const basePlatform = PLATFORM_PRESETS[selectedPlatform];

  let finalSettings: StoryConfig['settings'];

  if (shouldMerge && prevConfig?.settings) {
    finalSettings = {
      ...prevConfig.settings,
      captions: {
        ...(prevConfig.settings.captions || {}),
      },
    };
  } else {
    finalSettings = {
      platform: selectedPlatform,
      width: basePlatform.width,
      height: basePlatform.height,
      fps: basePlatform.fps,
      container: basePlatform.container,
      videoCodec: basePlatform.videoCodec,
      crf: basePlatform.crf,
      preset: basePlatform.preset,
      pixelFormat: basePlatform.pixelFormat,
      audioCodec: basePlatform.audioCodec,
      audioBitrate: basePlatform.audioBitrate,
      gpuAcceleration: basePlatform.gpuAcceleration,
      concurrency: 'auto',
      fastIntermediate: true,
      fastStart: basePlatform.fastStart,
      captions: {
        preset: selectedCaptionPreset,
        subtitleMode: selectedSubtitleMode,
        position: 'bottom',
        wordsPerPhrase,
        highlightPreset,
        highlightColor
      },
      transition: {
        enabled: enableTransitions,
        type: transitionType,
        duration: 1.0,
        audioBehavior: 'pad'
      },
      upscale: {
        enabled: enableUpscale,
        model: upscaleModel
      },
      depth3d: {
        enabled: enableDepth3D,
        mode: depth3DMode,
        frameStyle: depth3DStyle,
        popOutIntensity: 1.15,
        shadow: true,
        floatMotion: true,
      },
      tts: enableTTS ? {
        provider: 'vieneu-v3-turbo',
        voice: ttsVoice,
        speed: 1.0
      } : undefined
    };
  }

  const resultConfig: StoryConfig = {
    name: shouldMerge && prevConfig?.name ? prevConfig.name : storyName,
    description: shouldMerge && prevConfig?.description !== undefined ? prevConfig.description : storyDesc,
    settings: finalSettings,
    scenes,
  };

  fs.writeFileSync(configPath, JSON.stringify(resultConfig, null, 2), 'utf-8');

  console.log(`\n Hoàn tất! Đã lưu file cấu hình:`);
  console.log(` -> ${configPath}`);
  console.log(`\nBây giờ bạn có thể render video ngay bằng lệnh:`);
  console.log(`bun run cli.ts "${absoluteDir}"\n`);
}

main().catch((err) => {
  console.error('Lỗi không xác định:', err);
  process.exit(1);
});
