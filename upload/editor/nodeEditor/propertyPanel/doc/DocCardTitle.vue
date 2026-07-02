<template>
  <div
    class="doc-card-title q-my-xs q-mr-sm cursor-pointer"
    :id="id"
    @click="onClick"
  >{{ props.title }}</div>
</template>

<script setup>
import { computed } from 'vue'
const specialRE = /[\s·/_\\,:;\.\(\)\[\]]+/g
const andRE = /&/g
const nonWordRE = /[^\w-]+/g
const multipleDashRE = /--+/g

  function slugify (str) {
  return String(str).toLowerCase()
    .replace(specialRE, '-')
    .replace(andRE, '-and-')
    .replace(nonWordRE, '')
    .replace(multipleDashRE, '-')
}
function copyHeading (id) {
  const text = window.location.origin + window.location.pathname + '#' + id
  const el = document.getElementById(id)

  if (el) {
    el.id = ''
  }

  if ('replaceState' in history) {
    history.replaceState(history.state, '', `${location.pathname}#${id}`)
  }
  else {
    window.location.hash = '#' + id
  }

  if (el) {
    setTimeout(() => {
      el.id = id
    }, 300)
  }

  copyToClipboard(text)

  Notify.create({
    message: 'Anchor has been copied to clipboard.',
    position: 'top',
    actions: [{ icon: 'cancel', color: 'white', dense: true, round: true }],
    timeout: 2000
  })
}
const props = defineProps({
  title: String,
  prefix: String
})

const id = computed(() => (props.prefix || '') + slugify(props.title))

function onClick () {
  copyHeading(id.value)
}
</script>
