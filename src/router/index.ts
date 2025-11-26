import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase/client'
import SidebarLayout from '../components/SidebarLayout.vue'

// Importamos las vistas
import LoginView from '../views/LoginView.vue'
import CalendarView from '../views/CalendarView.vue'
import ServicesView from '../views/ServicesView.vue'
import ClientsView from '../views/ClientsView.vue'
import TeamView from '../views/TeamView.vue'
import DashboardView from '../views/DashboardView.vue'
import SettingsView from '../views/SettingsView.vue'
import TimeTrackerView from '../views/TimeTrackerView.vue'
import AdminTimeView from '../views/AdminTimeView.vue'
import ReportsView from '../views/ReportsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      // RUTA PADRE (Layout con menú)
      path: '/',
      component: SidebarLayout,
      meta: { requiresAuth: true }, // Protegida
      children: [
        {
          path: '', // Esto es /
          name: 'dashboard',
          component: DashboardView
        },
        {
          path: 'calendario',
          name: 'calendar',
          component: CalendarView
        },
        {
          path: 'servicios', // Esto es /servicios
          name: 'services',
          component: ServicesView
        },
        {
          path: 'clientes', // Esto es /clientes
          name: 'clients',
          component: ClientsView
        },
        {
          path: 'equipo',
          name: 'team',
          component: TeamView,
          meta: { requiresAuth: true, requiresAdmin: true }
        },
        {
          path: 'configuracion',
          name: 'settings',
          component: SettingsView,
          meta: {requiresAuth: true, requiresAdmin: true}
        },
        {
          path: 'fichar',
          name: 'timetracker',
          component: TimeTrackerView
        },
        {
          path: 'control-horario',
          name: 'admintime',
          component: AdminTimeView,
          meta: {requiresAuth: true, requiresAdmin: true}
        },
        {
          path: 'reportes',
          name: 'reports',
          component: ReportsView,
          meta: {requiresAuth: true, requiresAdmin: true}
        }
      ]
    }
  ]
})

// GUARDIA DE NAVEGACIÓN (El Segurata)
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()
  const userRole = localStorage.getItem('userRole')

  // 1. Si requiere Auth y no hay sesión -> Login
  if (to.matched.some(record => record.meta.requiresAuth) && !session) {
    next('/login')
  }
  // 2. Si requiere ADMIN y el rol no es admin -> A casa (Calendario)
  else if (to.matched.some(record => record.meta.requiresAdmin) && userRole !== 'admin') {
    alert('⛔ Acceso denegado: Solo para administradores.')
    next('/') 
  }
  // 3. Si ya estás dentro e intentas ir al login -> A casa
  else if (to.path === '/login' && session) {
    next('/')
  }
  else {
    next()
  }
})

export default router