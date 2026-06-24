import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/home'
  },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/home'
      },
      {
        path: 'home',
        component: () => import('@/views/LibraryPage.vue')
      },
      {
        path: 'insights',
        component: () => import('@/views/InsightsPage.vue')
      },
      {
        path: 'profile',
        component: () => import('@/views/ProfilePage.vue')
      }
    ]
  },
  {
    path: '/reader/:id',
    component: () => import('@/views/ReaderPage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
