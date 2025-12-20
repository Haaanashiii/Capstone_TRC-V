import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'Logos/*.png', 'Logos/*.gif'],
      manifest: {
        name: 'TRC-V',
        short_name: 'TRC-V',
        description: 'TRC-V Tricycle Regulatory Commission - Verification System for franchises, operators, and public',
        theme_color: '#0A356B',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // MINIMAL PWA CONFIGURATION FOR ADMIN DASHBOARD
        // Security-focused: Only cache static assets, never cache sensitive admin data
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Force immediate activation of new service worker
        inlineWorkboxRuntime: true,
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB to accommodate large assets
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//], // Never cache API routes offline
        
        // Only precache essential files (HTML, CSS, small images)
        // Large JS bundles and GIFs will be cached on first use (runtime caching)
        globPatterns: ['**/*.{html,css,png,svg,jpg,jpeg,ico,webp,woff,woff2}'],
        globIgnores: ['**/node_modules/**', '**/Logos/**'], // Exclude large logo assets
        
        runtimeCaching: [
          // 1. External fonts (safe to cache, improves performance)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          
          // 2. Static images (logos, icons) - CacheFirst for performance
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-images-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          
          // 3. API REQUESTS - NetworkFirst (always try server first)
          // CRITICAL: Admin operations require real-time data, no offline fallbacks for sensitive data
          {
            urlPattern: ({ url }) => {
              const pathname = url.pathname;
              return pathname.includes('/api/') || 
                     pathname.includes('/auth/') || 
                     pathname.includes('/franchise/') || 
                     pathname.includes('/admin/') ||
                     pathname.includes('/qr/');
            },
            handler: 'NetworkOnly', // CHANGED: Network-only for admin security
            options: {
              // No caching for admin API requests to prevent stale/sensitive data exposure
            }
          },
          
          // 4. JS/CSS bundles - NetworkFirst (always check for updates first)
          // Changed from StaleWhileRevalidate to ensure updates are fetched immediately
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-resources-cache',
              networkTimeoutSeconds: 3, // Fast timeout - fallback to cache if network slow
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true, // Enable PWA in development for testing
        type: 'module',
        navigateFallback: 'index.html'
      },
      // Reduce console noise in development
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
      }
    })
  ],
  build: {
    // Production optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console logs in production
        drop_console: mode === 'production',
        drop_debugger: mode === 'production'
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
        }
      }
    }
  }
}))
