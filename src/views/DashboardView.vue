<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/client'
import StatsCard from '../components/StatsCard.vue'
import QuickPayModal from '../components/QuickPayModal.vue'

const isAdmin = ref(false)
const loading = ref(true)
const showQuickPay = ref(false)

const stats = ref({
  todayAppointments: 0,
  monthRevenue: 0,
  totalClients: 0,
  pending: 0
})

const todayList = ref<any[]>([]) // <--- NUEVO: Lista de citas de hoy

const fetchStats = async () => {
  loading.value = true
  
  const today = new Date()
  // Truco: Primer día del mes a las 00:00:00
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  
  const todayStart = new Date(today.setHours(0,0,0,0)).toISOString()
  const todayEnd = new Date(today.setHours(23,59,59,999)).toISOString()

  // 1. Citas de HOY
  const { data: todayData, count: todayCount } = await supabase
    .from('appointments')
    .select(`
      id, date, status,
      customers (name),
      services (name),
      profiles (full_name)
    `, { count: 'exact' })
    .gte('date', todayStart)
    .lt('date', todayEnd)
    .order('date', { ascending: true })

  todayList.value = todayData || []

  // 2. Total Clientes
  const { count: clientsCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  // 3. INGRESOS DEL MES (VERSIÓN BLINDADA) 💰
  const { data: monthData } = await supabase
    .from('appointments')
    .select(`
      id,
      status,
      payments (amount)  
    `)
    .gte('date', firstDayOfMonth)
    .eq('status', 'completed') // Solo lo cobrado

  // Depuración: Mira la consola para ver qué llega
  console.log('Datos brutos para ingresos:', monthData)

  const revenue = monthData?.reduce((sum, appt: any) => {
    let amount = 0
    
    // Verificamos si payments es un array y tiene datos
    if (Array.isArray(appt.payments) && appt.payments.length > 0) {
      amount = Number(appt.payments[0].amount) // Forzamos a número
    } 
    // Por si acaso Supabase devuelve un objeto en vez de array (raro, pero posible)
    else if (appt.payments && typeof appt.payments === 'object') {
      amount = Number(appt.payments.amount)
    }

    return sum + (isNaN(amount) ? 0 : amount)
  }, 0) || 0

  // 4. Pendientes
  const { count: pendingCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  stats.value = {
    todayAppointments: todayCount || 0,
    monthRevenue: revenue,
    totalClients: clientsCount || 0,
    pending: pendingCount || 0
  }
  
  loading.value = false
}

// Formatear hora
const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  const role = localStorage.getItem('userRole')
  isAdmin.value = role === 'admin'
  fetchStats()
})
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-800">Hola, Equipo</h2>
      <p class="text-gray-500">Aquí tienes el resumen de hoy.</p>
    </div>

    <div v-if="loading" class="text-gray-500 text-center py-10">Cargando datos...</div>
    
    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatsCard title="Citas Hoy" :value="stats.todayAppointments"
        icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
            <path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd" />
          </svg>'
        color="red" />
        <StatsCard v-if="isAdmin" title="Ingresos Mes" :value="stats.monthRevenue + ' €'"
        icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.902 7.098a3.75 3.75 0 0 1 3.903-.884.75.75 0 1 0 .498-1.415A5.25 5.25 0 0 0 8.005 9.75H7.5a.75.75 0 0 0 0 1.5h.054a5.281 5.281 0 0 0 0 1.5H7.5a.75.75 0 0 0 0 1.5h.505a5.25 5.25 0 0 0 6.494 2.701.75.75 0 1 0-.498-1.415 3.75 3.75 0 0 1-4.252-1.286h3.001a.75.75 0 0 0 0-1.5H9.075a3.77 3.77 0 0 1 0-1.5h3.675a.75.75 0 0 0 0-1.5h-3c.105-.14.221-.274.348-.402Z" clip-rule="evenodd" />
          </svg>'
        color="green"
        trend="Cobrado real" />
        <StatsCard v-if="isAdmin" title="Clientes Totales" :value="stats.totalClients"
        icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
          </svg>'
        color="blue" />
        <StatsCard title="Pendientes" :value="stats.pending"
        icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
          </svg>'
        color="yellow" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-bold text-gray-800 text-lg">Agenda de Hoy</h3>
            <router-link to="/calendario" class="text-sm text-primary hover:underline">Ver calendario completo →</router-link>
          </div>
          
          <div v-if="todayList.length === 0" class="p-8 text-center text-gray-400 italic">
            No hay citas programadas para hoy. ¡Día tranquilo! 🏖️
          </div>

          <div v-else class="divide-y divide-gray-50">
            <div v-for="appt in todayList" :key="appt.id" class="p-4 flex items-center hover:bg-gray-50 transition">
              <div class="w-16 text-center font-mono font-bold text-gray-700 bg-gray-100 rounded py-1 mr-4">
                {{ formatTime(appt.date) }}
              </div>
              
              <div class="flex-1">
                <p class="font-bold text-gray-800">{{ appt.customers?.name || 'Bloqueo' }}</p>
                <p class="text-sm text-gray-500">
                  {{ appt.services?.name || 'No disponible' }} 
                  <span class="text-xs text-gray-400">• Atiende: {{ appt.profiles?.full_name }}</span>
                </p>
              </div>

              <div>
                <span v-if="appt.status === 'confirmed'" class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Confirmada</span>
                <span v-else-if="appt.status === 'completed'" class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Cobrada</span>
                <span v-else-if="appt.status === 'pending'" class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Pendiente</span>
                <span v-else class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">{{ appt.status }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h3 class="font-bold text-gray-800 mb-4">Acciones Rápidas</h3>
          <div class="space-y-3">
            <router-link to="/calendario" class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clip-rule="evenodd" />
              </svg>
              Nueva Cita
            </router-link>
            <router-link to="/clientes" class="block w-full text-center px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium border border-gray-200">
              Añadir Cliente
            </router-link>
            <router-link v-if="isAdmin" to="/fichar" class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
              </svg>
            Fichar Entrada/Salida
            </router-link>
            <button 
              @click="showQuickPay = true" 
              class="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium border border-green-200 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
                <path fill-rule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clip-rule="evenodd" />
                <path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z" />
              </svg>
              <span>Cobro Rápido</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
  <QuickPayModal 
  v-if="showQuickPay" 
  :is-open="showQuickPay" 
  @close="showQuickPay = false" 
  @saved="fetchStats" 
/>
</template>