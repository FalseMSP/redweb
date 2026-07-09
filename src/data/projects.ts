import type { Project } from '@/types/project';

/**
 * Portfolio content — RedLife Entertainment (FalseMSP).
 *
 * Card size is driven by `impressiveness` (0.7 small → 1.8 flagship) so the
 * most technically ambitious projects read as physically larger in the scene.
 *
 * Thumbnails are inline SVG data URLs (solid panels with the project initial)
 * so the scene boots without external asset dependencies. The ray traced audio
 * card uses the YouTube video thumbnail directly.
 */

const svgThumb = (label: string, hex: string, letter: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640" viewBox="0 0 512 640">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${hex}" stop-opacity="0.95"/>
          <stop offset="1" stop-color="#05060A" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <rect width="512" height="640" fill="url(#g)"/>
      <g fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2">
        <path d="M0 128 H512 M0 256 H512 M0 384 H512 M0 512 H512"/>
        <path d="M128 0 V640 M256 0 V640 M384 0 V640"/>
      </g>
      <text x="256" y="320" font-family="Space Grotesk, sans-serif" font-size="180" fill="rgba(255,255,255,0.92)" font-weight="700" text-anchor="middle" dominant-baseline="middle">${letter}</text>
      <text x="32" y="600" font-family="Space Grotesk, sans-serif" font-size="22" fill="rgba(255,255,255,0.78)" font-weight="700">${label}</text>
    </svg>`,
  )}`;

export const projects: Project[] = [
  // ─── Flagship ────────────────────────────────────────────────────────────
  {
    id: 'ray-traced-audio',
    title: 'Ray Traced Audio Engine',
    description:
      'An abstracted ray traced sound engine built on OpenAL, designed to handle three different software architectures while running on all hardware and operating systems. The engine uses non-blocking multithreading for efficiency, allowing audio processing to scale without bottlenecking the main render loop. The project has accumulated over half a million users across its lifetime and remains actively maintained — 112 issues closed, four total contributors, with FalseMSP as git master and majority contributor. The full technical breakdown — including the ray tracing acceleration structure, the threading model, and the architecture abstraction layer — is in the video linked below.',
    thumbnail: 'https://img.youtube.com/vi/xYEn5TlQ6Yw/maxresdefault.jpg',
    tags: ['OpenAL', 'C++', 'Audio', 'Open Source'],
    year: 2025,
    impressiveness: 1.8,
    stats: [
      { label: 'Users', value: '500K+' },
      { label: 'Issues Closed', value: '112' },
      { label: 'Contributors', value: '4' },
      { label: 'Architectures', value: '3' },
    ],
    links: [
      { label: 'Technical Video', url: 'https://youtu.be/xYEn5TlQ6Yw' },
      { label: 'GitHub — FalseMSP', url: 'https://github.com/FalseMSP/' },
    ],
  },

  // ─── Mocap ───────────────────────────────────────────
  {
    id: 'realtime-mocap',
    title: 'Realtime 3D Mocap & Pose Estimation',
    description:
      'A realtime 3D pose estimation pipeline built on OpenCV, designed to track fingers, hands, and faces on weak hardware where most CV pipelines fall over. The system handles edge cases gracefully — partial occlusions, fast motion, low light — instead of losing tracking like a naive implementation would. Data is encoded as a USB stream and sent to a host computer live, so the mocap data can drive character rigs or interaction in real time. Emotions are classified as floats rather than discrete labels, giving character rigs a continuous expressive range instead of canned happy / sad / angry states.',
    thumbnail: 'https://img.youtube.com/vi/FsLxQOMi2Yc/maxresdefault.jpg',
    tags: ['OpenCV', 'Computer Vision', 'Real-time'],
    year: 2026,
    impressiveness: 1.5,
    links: [{ label: 'Demo Video', url: 'https://youtu.be/FsLxQOMi2Yc' }],
  },

  // ─── Solid engineering ───────────────────────────────────────────────────
  {
    id: 'chat-merge-plus',
    title: 'Chat Merge+',
    description:
      'A multi-platform chat mirroring service that syncs Twitch, YouTube, and Discord with sub-0.1-second latency. Hosted 24/7 on an Oracle Cloud server for 100% uptime, using the Google Cloud API for the cross-platform translation layer. A plugin API allows rapid prototyping and deployment using continuous integration and delivery, so new platform integrations or feature experiments ship without touching the core. A dashboard gives easy access to logs and error tracking, and the service implements various engagement features missing from YouTube\'s native chat.',
    thumbnail: svgThumb('CHAT MERGE+', '#9146FF', 'C'),
    tags: ['Google Cloud', 'Real-time', 'CI/CD', 'Oracle Cloud'],
    year: 2026,
    impressiveness: 1.2,
    stats: [
      { label: 'Latency', value: '<100ms' },
      { label: 'Uptime', value: '100%' },
      { label: 'Platforms', value: '3' },
    ],
  },

  {
    id: 'content-creation-tool',
    title: 'YouTube → Shorts Converter',
    description:
      'An automated YouTube-video-to-Shorts converter that takes a long-form video and produces vertical short-form cuts suitable for YouTube Shorts. Verified for the Google Cloud API (which matters — Google\'s API approval process for video tooling is non-trivial). The tool has generated over 500,000 views across the Shorts it produced, which is the metric that actually matters for this kind of automation.',
    thumbnail: 'https://img.youtube.com/vi/GO7JgBozQ8k/maxresdefault.jpg',
    tags: ['Google Cloud API', 'Automation', 'YouTube'],
    year: 2023,
    impressiveness: 1.1,
    stats: [
      { label: 'Views Generated', value: '500K+' },
      { label: 'API', value: 'Verified' },
    ],
  },

  // ─── Standard ────────────────────────────────────────────────────────────
  {
    id: 'generalized-rag',
    title: 'Generalized RAG Implementation',
    description:
      'A lightweight, cheap RAG (Retrieval Augmented Generation) implementation with full configurability — backend LLM and embedding model are both swappable without code changes. Built to be cheap to run, with an intuitive UI and straightforward setup, rather than the over-engineered enterprise RAG frameworks that assume a dedicated DevOps team. The intent is a tool you can deploy in an afternoon and actually afford to keep running.',
    thumbnail: svgThumb('GENERALIZED RAG', '#7A4DFF', 'R'),
    tags: ['RAG', 'LLM', 'AI'],
    year: 2026,
    impressiveness: 1.0,
  },

  {
    id: 'agentic-plugin-dev',
    title: 'Agentic Plugin Development',
    description:
      'A loop workflow with Claude for plugin and dashboard development, designed to compress the iteration cycle on shipping new integrations. The agent handles scaffolding, boilerplate, and repetitive deployment tasks, while the human handles architecture and review. The result is faster, more efficient development of plugins for the Chat Merge+ ecosystem and adjacent tooling.',
    thumbnail: svgThumb('AGENTIC PLUGINS', '#D97757', 'A'),
    tags: ['Claude', 'Workflow', 'Automation'],
    year: 2026,
    impressiveness: 0.8,
  },

  // ─── Foundation / learning ───────────────────────────────────────────────
  {
    id: 'oci-deployment',
    title: 'OCI Infrastructure Deployment',
    description:
      'Deployment of a Minecraft server and supporting services on Oracle Cloud Infrastructure, running Arch Linux. Learned the full OCI stack — VCNs, compute instances, firewalling, routing, PuTTy for SSH, security subnets, user auth specifications, and permission handling. Less technically novel than other projects in this portfolio, but a useful foundation: the same infrastructure now hosts Chat Merge+ and other 24/7 services.',
    thumbnail: svgThumb('OCI DEPLOYMENT', '#9CA3AF', 'O'),
    tags: ['OCI', 'Arch Linux', 'Infrastructure'],
    year: 2022,
    impressiveness: 0.7,
  },
];
