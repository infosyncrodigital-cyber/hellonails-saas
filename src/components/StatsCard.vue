<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  icon: string // Ahora aquí recibiremos el código SVG entero
  color: string
  trend?: string
}>()
</script>

<template>
  <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
    <div>
      <p class="text-sm font-medium text-gray-500 mb-1">{{ title }}</p>
      <h3 class="text-2xl font-bold text-gray-800">{{ value }}</h3>
      <p v-if="trend" class="text-xs font-medium mt-2 text-green-600 flex items-center gap-1">
        <span>{{ trend }}</span>
      </p>
    </div>
    
    <div 
      :class="`p-3 rounded-full bg-${color}-50 text-${color}-600 flex items-center justify-center`"
      v-html="icon"
    >
    </div>
  </div>
</template>

<style>
/* Aseguramos que el SVG dentro tenga buen tamaño */
.bg-blue-50 svg, .bg-green-50 svg, .bg-purple-50 svg, .bg-yellow-50 svg {
  width: 2rem;  /* w-8 */
  height: 2rem; /* h-8 */
}
</style>