(function() {
    const canvas = document.getElementById('ausDotGrid');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Accurate Australia SVG paths from Simple World Map (CC BY-SA 3.0, Al MacDonald / Fritz Lekschas)
    // Original viewBox reference: x=672 y=587 w=140 h=115 (approx bounding box within the world map)
    // We normalise to a 0-1000 x 0-850 coordinate space for our canvas

    // Mainland path (from world-map.svg id="au" mainland)
    const MAINLAND_D = 'M672.961,609.067l-0.303,21.938l-3.371,2.472l-0.303,2.161l4.598,3.086l11.35-2.161h5.826l2.145-3.095l12.879-2.472l9.198,2.784l-0.614,3.708l1.228,3.708l7.055-1.236l0.303,1.851l-4.599,3.396l1.53,1.236l3.37-1.236l-0.917,10.2l6.44,4.944l3.683-1.236l1.841,1.852l10.735-1.548l10.123-16.381l3.682-0.925l7.357-13.596l1.841-11.739l-4.599-5.869l1.842-1.236l-3.684-11.436l-3.984-2.783l0.614-15.448l-3.684-2.782l-0.916-8.652h-1.842l-6.138,20.392l-3.37,0.312l-7.668-7.728l4.297-11.437l-7.971-1.547l-8.896,2.472l-2.454,7.104l-3.984,0.925l-0.304-4.944l-16.252,9.889l0.304,3.708l-2.454,3.397h-6.139l-13.19,5.56L672.961,609.067z';

    // Tasmania path
    const TASMANIA_D = 'M728.775,668.089l-1.531,6.181l0.304,4.322l4.599-0.312l5.213-8.03L728.775,668.089z';

    // Bounding box of the AU paths in the world-map SVG coordinate space
    const SRC_MIN_X = 669.0;
    const SRC_MIN_Y = 569.0;
    const SRC_W = 100.0;
    const SRC_H = 110.0;
    
    // Horizontal stretch factor to compensate for visual narrowing from rotation
    const H_STRETCH = 1.15;

    // We'll render into a normalised 1000x750 space
    const PATH_W = 1000;
    const PATH_H = 750;

    // Current job locations spread across Australia (normalised 0-1000 x 0-750)
    // Mapped from the SVG source coordinates
    function srcToNorm(sx, sy) {
        return [(sx - SRC_MIN_X) / SRC_W * PATH_W, (sy - SRC_MIN_Y) / SRC_H * PATH_H];
    }

    // Current job locations in source SVG coords
    // 75% along east edge, 25% spread across the map
    const jobsSrc = [
        // East edge (75% = 15 dots)
        [758, 630],   // Sydney
        [756, 610],   // Brisbane
        [752, 595],   // North QLD
        [748, 652],   // Melbourne
        [758, 622],   // Hunter Valley
        [760, 618],   // Central Coast
        [756, 638],   // Wollongong
        [760, 625],   // Newcastle
        [756, 645],   // South coast NSW
        [758, 614],   // Gold Coast
        [756, 628],   // Canberra
        [752, 618],   // Grafton
        [748, 593],   // Mackay
        [750, 642],   // Batemans Bay
        [748, 648],   // Geelong
        // Spread across (25% = 5 dots)
        [712, 638],   // Adelaide
        [680, 618],   // Perth
        [700, 595],   // NT
        [725, 610],   // Inland QLD
        [730, 645],   // Western VIC
    ];

    // Completed project locations (shown as solid white dots)
    // 75% along east edge, 25% spread across the map
    const completedSrc = [
        // East edge (75% = 22 dots)
        [760, 643],   // South coast NSW
        [754, 605],   // Bundaberg
        [750, 600],   // Rockhampton
        [756, 620],   // Coffs Harbour
        [758, 635],   // Southern Highlands
        [746, 600],   // Gladstone
        [752, 612],   // Sunshine Coast
        [748, 655],   // Western Port
        [754, 625],   // Maitland
        [750, 610],   // Toowoomba
        [756, 648],   // Nowra
        [746, 640],   // Shepparton
        [752, 632],   // Blue Mountains
        [748, 605],   // Hervey Bay
        [754, 615],   // Lismore
        [750, 645],   // Bega
        [746, 595],   // Townsville
        [752, 640],   // Goulburn
        [748, 625],   // Tamworth
        [754, 650],   // Warragul
        [746, 615],   // Armidale
        [750, 635],   // Queanbeyan
        // Spread across (25% = 8 dots)
        [732, 672],   // Tasmania
        [687, 642],   // Southern WA
        [698, 622],   // SA outback
        [693, 608],   // Pilbara
        [716, 635],   // Broken Hill
        [706, 598],   // Tennant Creek
        [722, 645],   // Riverina
        [700, 635],   // Port Augusta
    ];

    const currentJobs = jobsSrc.map(j => {
        const [x, y] = srcToNorm(j[0], j[1]);
        return { x, y };
    });

    const completedJobs = completedSrc.map(j => {
        const [x, y] = srcToNorm(j[0], j[1]);
        return { x, y };
    });

    const DOT_SIZE_BASE = 4.5;
    const GAP_BASE = 11;
    const BASE_COLOR = '#FFFFFF';
    const ACTIVE_COLOR = '#CCDB2A';
    const HOVER_RADIUS = 120;
    const PUSH_RADIUS = 140;
    const PUSH_STRENGTH = 5;
    const HIGHLIGHT_RADIUS = 12;

    // Responsive: scale dot size and gap relative to canvas width
    // Desktop ~800px canvas = base values. Mobile ~375px = smaller dots, tighter gap
    let DOT_SIZE = DOT_SIZE_BASE;
    let GAP = GAP_BASE;

    let dots = [];
    let pointer = { x: -9999, y: -9999 };
    let canvasW = 0, canvasH = 0;
    let scale = 1, offsetX = 0, offsetY = 0;
    let mainlandPath, tasmaniaPath;

    function hexToRgb(hex) {
        const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (!m) return { r: 0, g: 0, b: 0 };
        return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
    }

    const baseRgb = hexToRgb(BASE_COLOR);
    const activeRgb = hexToRgb(ACTIVE_COLOR);

    // Transform SVG path string from source coords to our normalised space
    function transformPath(d) {
        return new Path2D(d);
    }

    // The world-map SVG uses Robinson projection which tilts Australia clockwise.
    // We counter-rotate the coordinate lookup to straighten it.
    const ROTATION_DEG = -14;
    const ROTATION_RAD = ROTATION_DEG * Math.PI / 180;
    const COS_R = Math.cos(ROTATION_RAD);
    const SIN_R = Math.sin(ROTATION_RAD);
    // Rotation centre in source SVG coords (centre of Australia)
    const ROT_CX = SRC_MIN_X + SRC_W / 2;
    const ROT_CY = SRC_MIN_Y + SRC_H / 2;

    function buildGrid() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvasW = rect.width;
        canvasH = rect.height;
        
        // Scale dots for mobile to maintain similar density as desktop
        const scaleFactor = Math.min(1, canvasW / 700);
        DOT_SIZE = DOT_SIZE_BASE * scaleFactor;
        GAP = GAP_BASE * scaleFactor;
        
        canvas.width = canvasW * dpr;
        canvas.height = canvasH * dpr;
        canvas.style.width = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Build Path2D objects from SVG path data
        mainlandPath = transformPath(MAINLAND_D);
        tasmaniaPath = transformPath(TASMANIA_D);

        // Compute scale to fit the source bounding box into canvas
        const padX = canvasW * 0.03;
        const padY = canvasH * 0.03;
        const drawW = canvasW - padX * 2;
        const drawH = canvasH - padY * 2;
        const scaleX = drawW / (SRC_W * H_STRETCH);
        const scaleY = drawH / SRC_H;
        scale = Math.min(scaleX, scaleY);
        offsetX = padX + (drawW - SRC_W * H_STRETCH * scale) / 2;
        offsetY = padY + (drawH - SRC_H * scale) / 2;

        // Generate dot grid and test which dots fall inside Australia
        dots = [];
        const cell = DOT_SIZE + GAP;
        const cols = Math.ceil(canvasW / cell);
        const rows = Math.ceil(canvasH / cell);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = c * cell + cell / 2;
                const cy = r * cell + cell / 2;

                // Convert canvas pixel to source SVG coordinates for hit testing
                // Apply inverse rotation to straighten Australia from Robinson projection tilt
                const rawSrcX = (cx - offsetX) / scale / H_STRETCH + SRC_MIN_X;
                const rawSrcY = (cy - offsetY) / scale + SRC_MIN_Y;
                // Rotate point around centre of AU bounding box
                const relX = rawSrcX - ROT_CX;
                const relY = rawSrcY - ROT_CY;
                const srcX = ROT_CX + relX * COS_R + relY * SIN_R;
                const srcY = ROT_CY - relX * SIN_R + relY * COS_R;

                // Test point against paths using canvas transform
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                const inside = ctx.isPointInPath(mainlandPath, srcX, srcY) ||
                               ctx.isPointInPath(tasmaniaPath, srcX, srcY);
                ctx.restore();

                if (inside) {
                    // Check if near a current job (in normalised coords)
                    const normX = (srcX - SRC_MIN_X) / SRC_W * PATH_W;
                    const normY = (srcY - SRC_MIN_Y) / SRC_H * PATH_H;

                    let dotType = 'base'; // base | current | completed
                    for (const job of currentJobs) {
                        const dx = normX - job.x;
                        const dy = normY - job.y;
                        if (dx * dx + dy * dy < HIGHLIGHT_RADIUS * HIGHLIGHT_RADIUS) {
                            dotType = 'current';
                            break;
                        }
                    }
                    if (dotType === 'base') {
                        for (const job of completedJobs) {
                            const dx = normX - job.x;
                            const dy = normY - job.y;
                            if (dx * dx + dy * dy < HIGHLIGHT_RADIUS * HIGHLIGHT_RADIUS) {
                                dotType = 'completed';
                                break;
                            }
                        }
                    }

                    dots.push({
                        cx, cy,
                        xOffset: 0,
                        yOffset: 0,
                        dotType: dotType
                    });
                }
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvasW, canvasH);

        const hoverSq = HOVER_RADIUS * HOVER_RADIUS;
        const px = pointer.x;
        const py = pointer.y;
        
        // Pulse animation for green dots (breathing scale)
        const time = performance.now() * 0.001;
        const pulse = 1 + 0.2 * Math.sin(time * 2.2);

        for (const dot of dots) {
            const ox = dot.cx + dot.xOffset;
            const oy = dot.cy + dot.yOffset;

            const dx = dot.cx - px;
            const dy = dot.cy - py;
            const dsq = dx * dx + dy * dy;

            const radius = DOT_SIZE / 2;

            if (dot.dotType === 'current') {
                // Filled lime dot at 2x size with pulse
                let alpha = 0.95;
                if (dsq <= hoverSq) {
                    const t = 1 - Math.sqrt(dsq) / HOVER_RADIUS;
                    alpha = Math.min(1, alpha + t * 0.05);
                }
                const pulseRadius = radius * 2 * pulse;
                ctx.beginPath();
                ctx.arc(ox, oy, pulseRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${activeRgb.r},${activeRgb.g},${activeRgb.b},${alpha})`;
                ctx.fill();
            } else if (dot.dotType === 'completed') {
                // Solid white dot (brighter than base)
                let alpha = 0.85;
                if (dsq <= hoverSq) {
                    const t = 1 - Math.sqrt(dsq) / HOVER_RADIUS;
                    alpha = Math.min(1, alpha + t * 0.15);
                }
                ctx.beginPath();
                ctx.arc(ox, oy, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                ctx.fill();
            } else {
                // Base dot: subtle white
                let r = baseRgb.r, g = baseRgb.g, b = baseRgb.b;
                let alpha = 0.3;

                // Proximity hover: blend toward lime
                if (dsq <= hoverSq) {
                    const dist = Math.sqrt(dsq);
                    const t = 1 - dist / HOVER_RADIUS;
                    r = Math.round(r + (activeRgb.r - r) * t);
                    g = Math.round(g + (activeRgb.g - g) * t);
                    b = Math.round(b + (activeRgb.b - b) * t);
                    alpha = Math.min(1, alpha + t * 0.6);
                }

                ctx.beginPath();
                ctx.arc(ox, oy, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
                ctx.fill();
            }
        }

        requestAnimationFrame(draw);
    }

    // Mouse tracking with GSAP-powered spread on hover
    let lastPushTime = 0;
    function onMove(e) {
        const rect = canvas.getBoundingClientRect();
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;

        // Only trigger push if pointer moved significantly
        const movedDist = Math.hypot(newX - pointer.x, newY - pointer.y);
        pointer.x = newX;
        pointer.y = newY;

        // Spread dots away from cursor on hover (throttled)
        const now = performance.now();
        if (movedDist > 3 && now - lastPushTime > 50) {
            lastPushTime = now;
            pushDotsFromPoint(newX, newY);
        }
    }

    function pushDotsFromPoint(cx, cy) {
        for (const dot of dots) {
            const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
            if (dist < PUSH_RADIUS && dist > 0) {
                gsap.killTweensOf(dot);
                const falloff = Math.max(0, 1 - dist / PUSH_RADIUS);
                const angle = Math.atan2(dot.cy - cy, dot.cx - cx);
                const pushX = Math.cos(angle) * PUSH_STRENGTH * falloff * (PUSH_RADIUS - dist) * 0.04;
                const pushY = Math.sin(angle) * PUSH_STRENGTH * falloff * (PUSH_RADIUS - dist) * 0.04;

                gsap.to(dot, {
                    xOffset: pushX,
                    yOffset: pushY,
                    duration: 0.2,
                    ease: 'power2.out',
                    onComplete: function() {
                        gsap.to(dot, {
                            xOffset: 0,
                            yOffset: 0,
                            duration: 1.8,
                            ease: 'elastic.out(1,0.6)'
                        });
                    }
                });
            }
        }
    }

    function onLeave() {
        pointer.x = -9999;
        pointer.y = -9999;
    }

    // Throttle helper
    function throttle(fn, limit) {
        let last = 0;
        return function() {
            const now = performance.now();
            if (now - last >= limit) {
                last = now;
                fn.apply(this, arguments);
            }
        };
    }

    buildGrid();
    draw();

    const throttledMove = throttle(onMove, 16);
    canvas.addEventListener('mousemove', throttledMove, { passive: true });
    canvas.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', function() {
        buildGrid();
    });
})();
