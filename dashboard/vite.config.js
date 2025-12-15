import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'Logos/*.png', 'Logos/*.gif'],
      manifest: {
        name: 'TRC-V Dashboard',
        short_name: 'TRC-V',
        description: 'TRC-V Tricycle Regulatory Commission Dashboard',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
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
        // Reduce console noise - only log errors in development
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Increase the max file size for precaching (5 MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Don't precache index.html (let it be handled by navigation fallback)
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^http/],
        // Cache strategies
        runtimeCaching: [
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
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          // Cache announcements API (public, important for offline)
          {
            urlPattern: /\/announcements/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'announcements-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache fare matrix (public data - used in Settings & Landing page)
          // Strategy: StaleWhileRevalidate - Shows cached version immediately, updates in background
          {
            urlPattern: ({ url }) => url.pathname.includes('/fare-matrix'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fare-matrix-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache user's own franchise data (for operators)
          {
            urlPattern: /\/auth\/me/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'user-data-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache franchise information for operators
          {
            urlPattern: /\/franchise-information\/my-franchises/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'my-franchises-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache API files (GridFS images - fare matrix, operator photos, etc.)
          // Strategy: CacheFirst - Images rarely change, serve from cache for speed
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/files/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'api-files-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // General API cache (fallback for other endpoints) - UPDATED for cross-origin
          {
            urlPattern: ({ url }) => {
              const pathname = url.pathname;
              return pathname.includes('/api/') || 
                     pathname.includes('/auth/') || 
                     pathname.includes('/franchise/') || 
                     pathname.includes('/qr/') || 
                     pathname.includes('/verify/');
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache uploads/images from server
          {
            urlPattern: /\/uploads\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
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
})
