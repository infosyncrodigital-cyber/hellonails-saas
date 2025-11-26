<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { supabase } from '../supabase/client'
import AppointmentModal from '../components/AppointmentModal.vue'

// Variable para el filtro
const selectedEmployeeFilter = ref<string>('all') // 'all' o el ID del empleado
const employees = ref<any[]>([]) // Lista para el desplegable
const allEvents = ref<any[]>([]) // Guardamos TODAS las citas aquí para poder filtrar sin recargar BD

// Estado
const showModal = ref(false)
const selectedDate = ref('')
const selectedAppointment = ref<any>(null) // <--- NUEVO: Guardar cita seleccionada

const calendarOptions = ref<any>({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek',

  locale: esLocale,
  headerToolbar: { 
  left: 'prev,next today', 
  center: 'title', 
  right: window.innerWidth < 768 ? 'timeGridDay,timeGridWeek' : 'dayGridMonth,timeGridWeek,timeGridDay' 
  },
  windowResize: (arg: any) => {
    if (arg.view.type === 'timeGridWeek' && window.innerWidth < 768) {
      arg.view.calendar.changeView('timeGridDay')
    } else if (arg.view.type === 'timeGridDay' && window.innerWidth >= 768) {
      arg.view.calendar.changeView('timeGridWeek')
    }
  },
  eventTimeFormat: { 
    hour: '2-digit',
    minute: '2-digit',
    meridiem: false
  },
  editable: true,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  slotMinTime: '09:00:00',
  slotMaxTime: '21:00:00',
  slotEventOverlap: false,
  allDaySlot: false,
  events: [],
  eventClick: handleEventClick,
  selectable: true,
  select: handleDateSelect, 
  height: 'auto',
  eventColor: '#3B82F6',
})

// Función para actualizar fecha/duración al arrastrar
const updateAppointmentDate = async (eventInfo: any) => {
  const event = eventInfo.event
  const newStart = event.start.toISOString()
  
  // FullCalendar a veces devuelve null en end si solo mueves y no redimensionas
  // Si es null, calculamos el final basándonos en la duración original
  let newEnd = event.end?.toISOString()
  
  if (!newEnd) {
    // Recuperamos duración original de las props extendidas o default 60 min
    // Nota: Esto es un fallback, normalmente FullCalendar calcula el end visualmente
    const durationMs = (event.extendedProps.services?.duration || 60) * 60000
    newEnd = new Date(event.start.getTime() + durationMs).toISOString()
  }

  // Actualizamos en Supabase
  const { error } = await supabase
    .from('appointments')
    .update({ date: newStart })
    .eq('id', event.id)

  if (error) {
    alert('Error al mover la cita: ' + error.message)
    eventInfo.revert() // Vuelve a poner la cita donde estaba si falla
  } else {
    // Opcional: Mostrar un "toast" o mensajito de éxito sutil
    console.log('Cita movida correctamente')
  }
}

// Al Soltar (Mover)
function handleEventDrop(dropInfo: any) {
  // Aquí podrías añadir validación de solapamiento si quisieras ser muy estricto
  // Por ahora, permitimos mover ágilmente
  updateAppointmentDate(dropInfo)
}

// Al Redimensionar (Estirar)
function handleEventResize(resizeInfo: any) {
  // OJO: Para redimensionar necesitamos cambiar la duración del servicio o tener campo 'end_time' en BD.
  // Como tu sistema se basa en "Servicio = Duración Fija", redimensionar visualmente
  // es complicado si no cambiamos la lógica de base de datos.
  
  // ESTRATEGIA SEGURA: Si estiras, solo cambiamos la hora de inicio si fuera necesario, 
  // pero idealmente deberíamos bloquear el resize si la duración es fija por servicio.
  
  // Si quieres permitir cambiar duración, tendrías que guardar 'custom_duration' en la cita.
  // Por simplicidad y coherencia con tu modelo "Servicio", voy a revertir el resize
  // y avisar al usuario.
  
  alert('La duración depende del servicio contratado. Cambia el servicio para modificar el tiempo.')
  resizeInfo.revert()
}

// Cargar Citas
const fetchAppointments = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, date, status, customer_id, service_id, employee_id, notes, photos,
      customers (name),
      services (name, duration),
      profiles (full_name, color)
    `)

  if (error) return console.error(error)

  // Procesamos los eventos
  allEvents.value = data.map((appt: any) => {
    const startTime = new Date(appt.date)
    
    // 1. DETECTAR SI ES UN BLOQUEO
    const isBlock = appt.status === 'blocked' || !appt.customer_id

    // 2. CALCULAR DURACIÓN
    const durationMin = isBlock ? 60 : (appt.services?.duration || 60)
    const endTime = new Date(startTime.getTime() + durationMin * 60000)
    
    // 3. DEFINIR APARIENCIA (Título y Color)
    let title = ''
    let backgroundColor = ''
    let textColor = '#ffffff' 

    const empName = appt.profiles?.full_name ? ` (${appt.profiles.full_name})` : ''

    if (isBlock) {
      title = `⛔ BLOQUEO${empName}`
      backgroundColor = '#E5E7EB' // Gris claro
      textColor = '#374151'       // Texto gris oscuro
    } else {
      // Es una cita normal
      const clientName = appt.customers?.name || 'Sin nombre'
      const serviceName = appt.services?.name || 'Servicio'
      const noteIcon = appt.notes ? ' 📝' : ''
      
      title = `${clientName} - ${serviceName}${empName}${noteIcon}`
      
      // --- AQUÍ ESTÁ EL CAMBIO ---
      // Lógica de colores según el estado (Pagado, Cancelado o Normal)
      if (appt.status === 'completed') {
        backgroundColor = '#059669' // Verde oscuro (Emerald)
        title = `✅ ${title}`       // Añadimos el check al título
      } else if (appt.status === 'cancelled') {
        backgroundColor = '#EF4444' // Rojo
      } else {
        // Si es normal (confirmed/pending), usamos el color del empleado
        backgroundColor = appt.profiles?.color || '#3B82F6'
      }
      // ---------------------------
    }
    
    return {
      id: appt.id,
      title: title,
      start: appt.date,
      end: endTime.toISOString(),
      backgroundColor: backgroundColor,
      textColor: textColor,
      borderColor: 'transparent',
      
      classNames: appt.status === 'pending' ? ['opacity-70', 'border-2', 'border-yellow-400'] : [],
      
      extendedProps: {
        customer_id: appt.customer_id,
        service_id: appt.service_id,
        employee_id: appt.employee_id,
        status: appt.status,
        notes: appt.notes,
        photos: appt.photos,
        date: appt.date,
        isBlock: isBlock
      }
    }
  })
  
  applyFilter()
}

const applyFilter = () => {
  if (selectedEmployeeFilter.value === 'all') {
    calendarOptions.value.events = allEvents.value
  } else {
    calendarOptions.value.events = allEvents.value.filter(e => 
      e.extendedProps.employee_id === selectedEmployeeFilter.value
    )
  }
}

// 1. Click en Cita -> EDITAR
function handleEventClick(clickInfo: any) {
  // Recuperamos los datos guardados en extendedProps
  const props = clickInfo.event.extendedProps
  
  selectedAppointment.value = {
    id: clickInfo.event.id,
    customer_id: props.customer_id,
    service_id: props.service_id,
    employee_id: props.employee_id,
    notes: props.notes,
    
    photos: props.photos, 
    
    status: props.status,
    date: props.date,
    isBlock: props.isBlock
  }
  
  selectedDate.value = '' 
  showModal.value = true
}

// 2. Click en Hueco -> CREAR
function handleDateSelect(selectInfo: any) {
  selectedDate.value = selectInfo.startStr
  selectedAppointment.value = null // Limpiamos cita seleccionada
  showModal.value = true
  selectInfo.view.calendar.unselect()
}

const onAppointmentSaved = () => {
  fetchAppointments()
}

onMounted(async () => {
  const { data } = await supabase.from('profiles').select('id, full_name, color')
  employees.value = data || []
  
  fetchAppointments()
})
</script>

<template>
  <div class="max-w-6xl mx-auto h-full">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-3xl font-bold text-gray-800">Agenda</h2>
        <p class="text-gray-500">Gestiona las citas</p>
      </div>
      
      <div class="flex gap-3">
        <select 
          v-model="selectedEmployeeFilter" 
          @change="applyFilter"
          class="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
        >
          <option value="all">Ver Todos</option>
          <option v-for="emp in employees" :key="emp.id" :value="emp.id">
            {{ emp.full_name }}
          </option>
        </select>

        <button @click="showModal = true" class="px-4 py-2 bg-primary text-white rounded-lg shadow hover:bg-blue-700 transition flex items-center gap-2">
          <span>+</span> <span class="hidden sm:inline">Nueva Cita</span>
        </button>
      </div>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 calendar-wrapper">
      <FullCalendar :options="calendarOptions" />
    </div>

    <AppointmentModal 
      v-if="showModal" 
      :is-open="showModal" 
      :initial-date="selectedDate"
      :appointment-to-edit="selectedAppointment"
      @close="showModal = false"
      @saved="onAppointmentSaved"
    />

  </div>
</template>

<style>
/* Pequeños retoques CSS para que FullCalendar se vea más 'Tailwind' */
.fc-toolbar-title {
  font-size: 1.25rem !important;
  font-weight: 600;
  color: #1F2937;
}
.fc-button {
  background-color: white !important;
  border: 1px solid #E5E7EB !important;
  color: #374151 !important;
  font-weight: 500 !important;
  text-transform: capitalize !important;
}
.fc-button-active {
  background-color: #EFF6FF !important;
  color: #2563EB !important;
  border-color: #2563EB !important;
}
.fc-col-header-cell-cushion {
  color: #4B5563;
  font-weight: 600;
  padding: 8px 0 !important;
}
.fc-timegrid-slot-label-cushion {
  font-size: 0.85rem;
  color: #9CA3AF;
}
</style>