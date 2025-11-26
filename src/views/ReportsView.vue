<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../supabase/client'

// Fechas por defecto: El mes actual
const today = new Date()
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

const startDate = ref(firstDay)
const endDate = ref(lastDay)
const loading = ref(false)

// --- UTILIDAD: CONVERTIR A CSV (VERSIÓN COMPATIBLE EXCEL ESPAÑA) ---
const downloadCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return alert('No hay datos en estas fechas.')

  // 1. Obtener cabeceras
  const headers = Object.keys(data[0])
  
  // 2. Convertir JSON a CSV (Usando PUNTO Y COMA ';' como separador)
  const csvContent = [
    headers.join(';'), // <--- CAMBIO AQUÍ (Cabecera)
    ...data.map(row => headers.map(fieldName => {
      let val = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName]
      // Limpiamos saltos de línea por si acaso
      val = String(val).replace(/(\r\n|\n|\r)/gm, " ")
      return `"${val}"`
    }).join(';')) // <--- CAMBIO AQUÍ (Filas)
  ].join('\r\n')

  // 3. Crear Blob con BOM (para tildes)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  
  // 4. Descargar
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// --- REPORTE 1: VENTAS / INGRESOS ---
const exportSales = async () => {
  loading.value = true
  
  // Buscamos citas COMPLETADAS (pagadas) en el rango
  // Y hacemos join con payments para saber el método de pago
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      date,
      customers (name),
      services (name),
      profiles (full_name),
      payments (amount, method)
    `)
    .gte('date', new Date(startDate.value).toISOString())
    .lt('date', new Date(endDate.value + 'T23:59:59').toISOString())
    .eq('status', 'completed')
    .order('date', { ascending: true })

  if (error) {
    alert('Error: ' + error.message)
    loading.value = false
    return
  }

  // Aplanar datos para el Excel
  const cleanData = data?.map((item: any) => ({
    Fecha: new Date(item.date).toLocaleDateString(),
    Hora: new Date(item.date).toLocaleTimeString(),
    Cliente: item.customers?.name || 'Anónimo',
    Servicio: item.services?.name || 'Vario',
    Empleado: item.profiles?.full_name || 'Desconocido',
    Importe: item.payments?.[0]?.amount || 0, // Cogemos el pago asociado
    Metodo_Pago: item.payments?.[0]?.method || 'No registrado'
  }))

  downloadCSV(cleanData || [], `Ventas_HelloNails_${startDate.value}_${endDate.value}`)
  loading.value = false
}

// --- REPORTE 2: CONTROL HORARIO (FICHAJES) ---
const exportTimeTracking = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      clock_in,
      clock_out,
      profiles (full_name, email)
    `)
    .gte('clock_in', new Date(startDate.value).toISOString())
    .lt('clock_in', new Date(endDate.value + 'T23:59:59').toISOString())
    .order('clock_in', { ascending: true })

  if (error) {
    alert('Error: ' + error.message)
    loading.value = false
    return
  }

  const cleanData = data?.map((item: any) => {
    // Calcular horas trabajadas
    let totalHoras = 'En curso'
    if (item.clock_out) {
      const diff = new Date(item.clock_out).getTime() - new Date(item.clock_in).getTime()
      totalHoras = (diff / 3600000).toFixed(2) // Horas en decimal (ej: 8.5h)
    }

    return {
      Empleado: item.profiles?.full_name,
      Email: item.profiles?.email,
      Fecha: new Date(item.clock_in).toLocaleDateString(),
      Entrada: new Date(item.clock_in).toLocaleTimeString(),
      Salida: item.clock_out ? new Date(item.clock_out).toLocaleTimeString() : 'Sin marcar',
      Horas_Totales: totalHoras
    }
  })

  downloadCSV(cleanData || [], `Fichajes_HelloNails_${startDate.value}_${endDate.value}`)
  loading.value = false
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-800">Reportes y Exportación</h2>
      <p class="text-gray-500">Descarga datos para tu gestor o contabilidad.</p>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h3 class="font-bold text-gray-700 mb-4">Selecciona Rango de Fechas</h3>
      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Desde</label>
          <input v-model="startDate" type="date" class="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-primary">
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Hasta</label>
          <input v-model="endDate" type="date" class="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-primary">
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col justify-between">
        <div class="flex items-center gap-4 mb-6">
          <div class="p-3 bg-green-100 text-green-600 rounded-full text-2xl shrink-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875Z" />
              <path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 0 0 1.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 0 0 1.897 1.384C6.809 12.164 9.315 12.75 12 12.75Z" />
              <path d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.809 15.914 9.315 16.5 12 16.5Z" />
              <path d="M12 20.25c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.809 19.664 9.315 20.25 12 20.25Z" />
            </svg>
          </div>
          <div>
            <h3 class="font-bold text-lg text-gray-800">Reporte de Ventas</h3>
            <p class="text-sm text-gray-500 leading-tight">Ingresos, métodos de pago y servicios.</p>
          </div>
        </div>
        
        <button 
          @click="exportSales" 
          :disabled="loading"
          class="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm"
        >
          <span v-if="loading" class="text-sm animate-pulse">Procesando...</span>
          <span v-else class="flex items-center gap-2 font-medium text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
              <path fill-rule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
            Descargar Excel (CSV)
          </span>
        </button>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col justify-between">
        <div class="flex items-center gap-4 mb-6">
          <div class="p-3 bg-blue-100 text-blue-600 rounded-full text-2xl shrink-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 class="font-bold text-lg text-gray-800">Control Horario</h3>
            <p class="text-sm text-gray-500 leading-tight">Entradas, salidas y horas totales.</p>
          </div>
        </div>
        
        <button 
          @click="exportTimeTracking" 
          :disabled="loading"
          class="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm"
        >
          <span v-if="loading" class="text-sm animate-pulse">Procesando...</span>
          <span v-else class="flex items-center gap-2 font-medium text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
              <path fill-rule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
            Descargar Excel (CSV)
          </span>
        </button>
      </div>

    </div>

  </div>
</template>