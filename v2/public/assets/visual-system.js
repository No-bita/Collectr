/**
 * Collectr Visual System Engine (v3 - Production Locked)
 * Motif: Paper -> System ("Chaos goes in. Order comes out.")
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getQualityTier() {
    if (prefersReducedMotion) return 'tier4_reduced_motion';

    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) return 'tier3_low_static';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const concurrency = navigator.hardwareConcurrency || 4;

      if (isMobile && concurrency < 4) {
        return 'tier2_medium';
      }
      return 'tier1_high';
    } catch (e) {
      return 'tier3_low_static';
    }
  }

  const qualityTier = getQualityTier();
  console.log(`[Collectr Visual System v2] Initialized Tier: ${qualityTier}`);

  function initHeroShader() {
    if (qualityTier === 'tier4_reduced_motion' || qualityTier === 'tier3_low_static') return;

    const heroSection = document.querySelector('main > section:first-child');
    if (!heroSection) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'heroShaderCanvas';
    canvas.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.35; transition: opacity 0.5s ease;';
    heroSection.style.position = 'relative';
    heroSection.insertBefore(canvas, heroSection.firstChild);

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const dpr = qualityTier === 'tier1_high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.5);
    const particleCount = qualityTier === 'tier1_high' ? 45 : 22;

    const vsSource = `
      attribute vec3 aPosition;
      attribute vec2 aTarget;
      attribute float aSeed;

      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec2 uResolution;

      varying float vAlpha;

      void main() {
        vec2 st = aPosition.xy;
        vec2 target = aTarget;
        
        float t = fract(uTime * 0.08 + aSeed);
        vec2 currentPos = mix(st, target, t * t);
        
        vec2 mouseSt = (uMouse / uResolution) * 2.0 - 1.0;
        mouseSt.y = -mouseSt.y;
        float dist = distance(currentPos, mouseSt);
        if (dist < 0.4) {
          vec2 dir = normalize(currentPos - mouseSt);
          currentPos += dir * (0.4 - dist) * 0.15;
        }

        gl_Position = vec4(currentPos, 0.0, 1.0);
        gl_PointSize = (3.0 + sin(uTime * 2.0 + aSeed * 10.0) * 1.5) * ${dpr.toFixed(1)};
        vAlpha = sin(t * 3.14159) * 0.6;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying float vAlpha;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        vec3 color = vec3(0.06, 0.09, 0.16);
        gl_FragColor = vec4(color, vAlpha * (1.0 - dist * 2.0));
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positions = [];
    const targets = [];
    const seeds = [];

    for (let i = 0; i < particleCount; i++) {
      positions.push((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 2.2, 0.0);
      const col = (i % 3 - 1) * 0.4;
      const row = (Math.floor(i / 3) / 10 - 0.5) * 1.2;
      targets.push(col, row);
      seeds.push(Math.random());
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);

    const targetBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, targetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(targets), gl.STATIC_DRAW);

    const aTargetLoc = gl.getAttribLocation(program, 'aTarget');
    gl.enableVertexAttribArray(aTargetLoc);
    gl.vertexAttribPointer(aTargetLoc, 2, gl.FLOAT, false, 0, 0);

    const seedBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seeds), gl.STATIC_DRAW);

    const aSeedLoc = gl.getAttribLocation(program, 'aSeed');
    gl.enableVertexAttribArray(aSeedLoc);
    gl.vertexAttribPointer(aSeedLoc, 1, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uMouseLoc = gl.getUniformLocation(program, 'uMouse');
    const uResLoc = gl.getUniformLocation(program, 'uResolution');

    let mouseX = 0, mouseY = 0;
    let targetMouseX = 0, targetMouseY = 0;

    window.addEventListener('mousemove', (e) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    }, { passive: true });

    function resize() {
      const width = heroSection.clientWidth;
      const height = heroSection.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let isVisible = true;
    let isTabActive = true;
    let animFrameId = null;
    let startTime = performance.now();

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible && isTabActive) startLoop();
      else stopLoop();
    }, { threshold: 0.05 });
    observer.observe(heroSection);

    document.addEventListener('visibilitychange', () => {
      isTabActive = !document.hidden;
      if (isVisible && isTabActive) startLoop();
      else stopLoop();
    });

    function render() {
      if (!isVisible || !isTabActive) return;

      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      const elapsed = (performance.now() - startTime) * 0.001;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform2f(uMouseLoc, mouseX, mouseY);
      gl.uniform2f(uResLoc, canvas.width, canvas.height);

      gl.drawArrays(gl.POINTS, 0, particleCount);
      animFrameId = requestAnimationFrame(render);
    }

    function startLoop() {
      if (!animFrameId) animFrameId = requestAnimationFrame(render);
    }

    function stopLoop() {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    }

    startLoop();
  }

  function overhaulSampleWorkspace() {
    const mockupContainer = document.querySelector('main > section:first-child .relative.rounded-2xl');
    if (!mockupContainer) return;

    mockupContainer.setAttribute('tabindex', '0');
    mockupContainer.style.outline = 'none';

    mockupContainer.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-line pb-3">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-success"></span>
            <span class="text-xs font-semibold text-ink">Sample Workspace · ITR FY 2026</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[11px] font-mono text-ink-muted">42 Clients</span>
            <span class="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">78% Complete</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div class="rounded-lg bg-surface p-2 border border-line/60">
            <div class="font-bold text-success">31</div>
            <div class="text-[10px] text-ink-muted">Complete</div>
          </div>
          <div class="rounded-lg bg-surface p-2 border border-line/60">
            <div class="font-bold text-warning">7</div>
            <div class="text-[10px] text-ink-muted">Pending</div>
          </div>
          <div class="rounded-lg bg-surface p-2 border border-line/60">
            <div class="font-bold text-ink">4</div>
            <div class="text-[10px] text-ink-muted">Review</div>
          </div>
        </div>

        <div class="space-y-2">
          <div tabindex="0" class="workspace-row group flex items-center justify-between rounded-lg border border-line/70 bg-background p-3 transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary">
            <div>
              <div class="text-xs font-semibold text-ink">Rahul Sharma</div>
              <div class="text-[10px] text-ink-muted group-hover:hidden">8 of 8 documents</div>
              <div class="hidden text-[10px] text-success group-hover:block font-medium">Last updated 2 min ago • All verified</div>
            </div>
            <span class="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">✓ Ready</span>
          </div>

          <div tabindex="0" class="workspace-row group flex items-center justify-between rounded-lg border border-line/70 bg-background p-3 transition hover:border-warning/40 focus-visible:ring-2 focus-visible:ring-warning">
            <div>
              <div class="text-xs font-semibold text-ink">Priya Mehta</div>
              <div class="text-[10px] text-ink-muted group-hover:hidden">6 of 8 documents</div>
              <div class="hidden text-[10px] text-warning group-hover:block font-medium">2 docs missing • Reminder sent 2h ago</div>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="alert('Demo: Automated WhatsApp reminder sent to Priya Mehta!')" class="hidden rounded bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition hover:bg-primary hover:text-white group-hover:inline-block">Send reminder →</button>
              <span class="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">○ Pending</span>
            </div>
          </div>

          <div tabindex="0" class="workspace-row group flex items-center justify-between rounded-lg border border-line/70 bg-background p-3 transition hover:border-ink/40 focus-visible:ring-2 focus-visible:ring-ink">
            <div>
              <div class="text-xs font-semibold text-ink">Amit Shah</div>
              <div class="text-[10px] text-ink-muted group-hover:hidden">7 of 8 documents</div>
              <div class="hidden text-[10px] text-ink group-hover:block font-medium">Form 26AS mismatch • Needs review</div>
            </div>
            <span class="rounded-full bg-surface-selected px-2 py-0.5 text-[10px] font-medium text-ink">⚠ Review</span>
          </div>

          <div tabindex="0" class="workspace-row group flex items-center justify-between rounded-lg border border-line/70 bg-background p-3 transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary">
            <div>
              <div class="text-xs font-semibold text-ink">Neha Kapoor</div>
              <div class="text-[10px] text-ink-muted group-hover:hidden">8 of 8 documents</div>
              <div class="hidden text-[10px] text-success group-hover:block font-medium">Last updated 1h ago • Filing ready</div>
            </div>
            <span class="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">✓ Ready</span>
          </div>
        </div>
      </div>
    `;
  }

  function initProblemScrollAnimation() {
    const problemSection = document.querySelector('section.bg-surface');
    if (!problemSection) return;

    const titleEl = problemSection.querySelector('h2');
    if (titleEl) {
      titleEl.innerHTML = `Tax season isn't chaotic. Your document collection process is.`;
    }

    const cardsContainer = problemSection.querySelector('.grid.gap-px');
    if (!cardsContainer) return;

    const svgWrapper = document.createElement('div');
    svgWrapper.id = 'problemSvgWrapper';
    svgWrapper.style.cssText = 'margin-bottom: 24px; text-align: center; padding: 16px; background: #ffffff; border: 1px solid #ECE8DF; border-radius: 16px;';
    
    svgWrapper.innerHTML = `
      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6E6A62; margin-bottom: 8px;">
        Collection Process Transformation
      </div>
      <svg id="chaosSvg" viewBox="0 0 600 120" style="width: 100%; max-width: 580px; height: auto; overflow: visible;">
        <g id="scatteredDocs" opacity="1">
          <g class="doc-card" transform="translate(40, 20) rotate(-12)">
            <rect width="70" height="40" rx="6" fill="#F4F3EF" stroke="#ECE8DF" />
            <text x="10" y="24" font-size="10" font-family="Inter, sans-serif" font-weight="600" fill="#171717">Form 16</text>
          </g>
          <g class="doc-card" transform="translate(160, 60) rotate(8)">
            <rect width="60" height="40" rx="6" fill="#F4F3EF" stroke="#ECE8DF" />
            <text x="10" y="24" font-size="10" font-family="Inter, sans-serif" font-weight="600" fill="#171717">PAN</text>
          </g>
          <g class="doc-card" transform="translate(270, 15) rotate(-6)">
            <rect width="85" height="40" rx="6" fill="#F4F3EF" stroke="#ECE8DF" />
            <text x="10" y="24" font-size="10" font-family="Inter, sans-serif" font-weight="600" fill="#171717">Bank Stmt</text>
          </g>
          <g class="doc-card" transform="translate(400, 50) rotate(14)">
            <rect width="60" height="40" rx="6" fill="#F4F3EF" stroke="#ECE8DF" />
            <text x="10" y="24" font-size="10" font-family="Inter, sans-serif" font-weight="600" fill="#171717">AIS</text>
          </g>
          <g class="doc-card" transform="translate(490, 25) rotate(-10)">
            <rect width="75" height="40" rx="6" fill="#F4F3EF" stroke="#ECE8DF" />
            <text x="10" y="24" font-size="10" font-family="Inter, sans-serif" font-weight="600" fill="#171717">Aadhaar</text>
          </g>
        </g>

        <g id="orderedChecklist" opacity="0">
          <rect x="50" y="20" width="500" height="80" rx="12" fill="#FFFFFF" stroke="#2563EB" stroke-width="1.5" />
          <text x="75" y="50" font-size="12" font-family="Inter, sans-serif" font-weight="700" fill="#16A34A">✓ Form 16</text>
          <text x="175" y="50" font-size="12" font-family="Inter, sans-serif" font-weight="700" fill="#16A34A">✓ PAN Card</text>
          <text x="275" y="50" font-size="12" font-family="Inter, sans-serif" font-weight="700" fill="#16A34A">✓ Bank Stmt</text>
          <text x="385" y="50" font-size="12" font-family="Inter, sans-serif" font-weight="700" fill="#16A34A">✓ AIS</text>
          <text x="455" y="50" font-size="12" font-family="Inter, sans-serif" font-weight="700" fill="#16A34A">✓ Aadhaar</text>
          <text x="75" y="75" font-size="10" font-family="Inter, sans-serif" font-weight="500" fill="#6E6A62">Verified & Filing-Ready Checklist • Handed to team</text>
        </g>
      </svg>
    `;

    cardsContainer.parentNode.insertBefore(svgWrapper, cardsContainer);

    if (qualityTier === 'tier4_reduced_motion') {
      document.getElementById('orderedChecklist').setAttribute('opacity', '1');
      document.getElementById('scatteredDocs').setAttribute('opacity', '0');
      return;
    }

    function updateScrollProgress() {
      const rect = problemSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      let progress = (windowHeight - rect.top) / (windowHeight + rect.height);
      progress = Math.max(0, Math.min(1, progress));

      const scattered = document.getElementById('scatteredDocs');
      const ordered = document.getElementById('orderedChecklist');

      if (scattered && ordered) {
        scattered.setAttribute('opacity', (1 - progress * 1.5).toFixed(2));
        ordered.setAttribute('opacity', (progress * 1.5 - 0.2).toFixed(2));
      }
    }

    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();
  }

  function initHowItWorksCSSGlow() {
    const stepCards = document.querySelectorAll('#how .rounded-2xl');
    stepCards.forEach((card) => {
      card.style.position = 'relative';
      card.style.transition = 'all 0.2s ease';

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.background = `radial-gradient(500px circle at ${x}px ${y}px, rgba(37, 99, 235, 0.05), #FFFFFF)`;
      }, { passive: true });

      card.addEventListener('mouseleave', () => {
        card.style.background = '';
      });
    });
  }

  function initCtaShader() {
    if (qualityTier === 'tier4_reduced_motion' || qualityTier === 'tier3_low_static') return;

    const ctaSection = document.getElementById('cta');
    if (!ctaSection) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'ctaShaderCanvas';
    canvas.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.4;';
    ctaSection.insertBefore(canvas, ctaSection.firstChild);

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vsSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform float uTime;
      uniform vec2 uResolution;

      void main() {
        vec2 st = gl_FragCoord.xy / uResolution.xy;
        float wave = sin(st.x * 3.0 + uTime * 0.4) * cos(st.y * 3.0 + uTime * 0.4);
        
        vec3 color1 = vec3(0.06, 0.09, 0.16);
        vec3 color2 = vec3(0.12, 0.11, 0.29);
        vec3 color3 = vec3(0.02, 0.37, 0.27);

        vec3 finalColor = mix(color1, color2, wave * 0.5 + 0.5);
        finalColor = mix(finalColor, color3, sin(uTime * 0.2) * 0.2 + 0.2);

        gl_FragColor = vec4(finalColor, 0.6);
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uResLoc = gl.getUniformLocation(program, 'uResolution');

    function resize() {
      canvas.width = ctaSection.clientWidth;
      canvas.height = ctaSection.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let isVisible = false;
    let animId = null;

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible) render();
      else if (animId) cancelAnimationFrame(animId);
    }, { threshold: 0.1 });
    observer.observe(ctaSection);

    function render() {
      if (!isVisible) return;
      gl.uniform1f(uTimeLoc, performance.now() * 0.001);
      gl.uniform2f(uResLoc, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeroShader();
    overhaulSampleWorkspace();
    initProblemScrollAnimation();
    initHowItWorksCSSGlow();
    initCtaShader();
  });
})();
