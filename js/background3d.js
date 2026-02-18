/**
 * Cosmic 3D Background System
 * GPU-friendly animated space background with stars, nebula, and particles
 * Performance-optimized with adaptive quality based on device capability
 */

class CosmicBackground3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = [];
        this.stars = [];
        this.nebula = null;
        this.animationFrame = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.clock = 0;
        
        // Quality settings (auto-adjusted)
        this.quality = {
            particleCount: 800,
            starCount: 400,
            nebulaResolution: 128,
            glowEnabled: true,
            mouseInteraction: true
        };
        
        // Detect device capability
        this.detectDeviceCapability();
        
        this.init();
    }

    detectDeviceCapability() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const gpuTier = this.estimateGPUPower();
        
        if (isMobile || gpuTier === 'low') {
            this.quality = {
                particleCount: 200,
                starCount: 150,
                nebulaResolution: 64,
                glowEnabled: false,
                mouseInteraction: false
            };
        } else if (gpuTier === 'medium') {
            this.quality = {
                particleCount: 400,
                starCount: 250,
                nebulaResolution: 128,
                glowEnabled: true,
                mouseInteraction: true
            };
        }
        // High quality uses defaults
    }

    estimateGPUPower() {
        // Simple heuristic: check if device is recent
        const performance = window.navigator.hardwareConcurrency || 4;
        if (performance <= 2) return 'low';
        if (performance <= 4) return 'medium';
        return 'high';
    }

    init() {
        if (typeof THREE === 'undefined') {
            this.loadThreeJS();
            return;
        }
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.createNebula();
        this.createStars();
        this.createParticles();
        this.setupEventListeners();
        this.animate();
    }

    loadThreeJS() {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = () => {
            // Add extras for advanced effects
            const extras = document.createElement('script');
            extras.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/stats.min.js';
            extras.onload = () => this.init();
            document.head.appendChild(extras);
        };
        document.head.appendChild(script);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = null;
        
        // Add fog for depth
        this.scene.fog = new THREE.FogExp2(0x0a0e27, 0.002);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 50;
        this.camera.position.y = 5;
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: this.quality.glowEnabled,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        
        const canvas = this.renderer.domElement;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '-1';
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity = '0.9';
        
        // Add gradient overlay for better text contrast
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'radial-gradient(circle at center, transparent 0%, rgba(10,14,39,0.4) 100%)';
        overlay.style.zIndex = '-1';
        overlay.style.pointerEvents = 'none';
        
        document.body.insertBefore(canvas, document.body.firstChild);
        document.body.insertBefore(overlay, canvas.nextSibling);
    }

    createNebula() {
        // Create multiple layers of nebula with different colors
        const colors = [
            [0.4, 0.2, 0.8, 0.15],  // Purple
            [0.2, 0.3, 0.8, 0.1],   // Blue
            [0.8, 0.3, 0.5, 0.08]   // Pink
        ];
        
        colors.forEach((color, index) => {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            
            for (let i = 0; i < this.quality.nebulaResolution; i++) {
                const x = (Math.random() - 0.5) * 200;
                const y = (Math.random() - 0.5) * 200;
                const z = (Math.random() - 0.5) * 200 - 50;
                vertices.push(x, y, z);
            }
            
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            
            const material = new THREE.PointsMaterial({
                color: new THREE.Color(color[0], color[1], color[2]),
                size: 1.5,
                transparent: true,
                opacity: color[3],
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const nebulaLayer = new THREE.Points(geometry, material);
            nebulaLayer.position.x = Math.sin(index) * 20;
            nebulaLayer.position.y = Math.cos(index) * 20;
            this.scene.add(nebulaLayer);
            this.nebula = nebulaLayer; // Store last for rotation
        });
    }

    createStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.quality.starCount * 3);
        const colors = new Float32Array(this.quality.starCount * 3);
        const sizes = new Float32Array(this.quality.starCount);

        for (let i = 0; i < this.quality.starCount; i++) {
            // Position - spread across sphere
            const r = 80 + Math.random() * 40;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Color - mostly white with slight variations
            const colorVal = 0.8 + Math.random() * 0.4;
            colors[i * 3] = colorVal;
            colors[i * 3 + 1] = colorVal * (0.8 + Math.random() * 0.3);
            colors[i * 3 + 2] = colorVal * (0.9 + Math.random() * 0.3);

            // Size variation
            sizes[i] = 0.1 + Math.random() * 0.3;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        this.stars = new THREE.Points(geometry, material);
        this.scene.add(this.stars);
    }

    createParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.quality.particleCount * 3);
        const colors = new Float32Array(this.quality.particleCount * 3);
        const speeds = new Float32Array(this.quality.particleCount);

        for (let i = 0; i < this.quality.particleCount; i++) {
            // Position - disk shape
            const angle = Math.random() * Math.PI * 2;
            const radius = 30 + Math.random() * 50;
            const height = (Math.random() - 0.5) * 60;
            
            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = height;
            positions[i * 3 + 2] = Math.sin(angle) * radius;

            // Color - cosmic palette
            const colorType = Math.random();
            if (colorType < 0.3) {
                colors[i * 3] = 0.4; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 1.0; // Blue
            } else if (colorType < 0.6) {
                colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.4; colors[i * 3 + 2] = 0.8; // Purple
            } else {
                colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.6; // White/Yellow
            }

            // Speed for animation
            speeds[i] = 0.2 + Math.random() * 0.8;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

        const material = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            map: this.createParticleTexture()
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // Create soft glow particle
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(16, 16, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Add gradient
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 8);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(200,200,255,0.5)');
        gradient.addColorStop(1, 'rgba(100,100,200,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        
        return new THREE.CanvasTexture(canvas);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        if (this.quality.mouseInteraction) {
            window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        }
    }

    onResize() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMouseMove(e) {
        this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    animate() {
        if (!this.scene || !this.camera || !this.renderer) return;

        this.animationFrame = requestAnimationFrame(() => this.animate());
        this.clock += 0.005;

        // Rotate stars slowly
        if (this.stars) {
            this.stars.rotation.y += 0.0001;
            this.stars.rotation.x += 0.00005;
        }

        // Animate particles
        if (this.particles) {
            this.particles.rotation.y += 0.0003;
            this.particles.rotation.x += 0.0001;
            
            // Subtle pulsating
            const positions = this.particles.geometry.attributes.position.array;
            const speeds = this.particles.geometry.attributes.speed?.array;
            
            if (speeds) {
                for (let i = 0; i < positions.length; i += 3) {
                    // Gentle floating motion
                    positions[i + 1] += Math.sin(this.clock + i) * 0.001 * speeds[i/3];
                }
                this.particles.geometry.attributes.position.needsUpdate = true;
            }
        }

        // Camera movement
        if (this.quality.mouseInteraction) {
            this.camera.position.x += (this.mouseX * 5 - this.camera.position.x) * 0.01;
            this.camera.position.y += (-this.mouseY * 5 - this.camera.position.y) * 0.01;
            this.camera.lookAt(this.scene.position);
        } else {
            // Auto-rotate camera
            this.camera.position.x = Math.sin(this.clock * 0.1) * 10;
            this.camera.position.y = 5;
            this.camera.position.z = 50 + Math.cos(this.clock * 0.1) * 5;
            this.camera.lookAt(this.scene.position);
        }

        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('mousemove', this.onMouseMove);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to let page load
    setTimeout(() => {
        window.cosmicBackground = new CosmicBackground3D();
    }, 100);
});