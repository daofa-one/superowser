<script setup lang="ts">
import { ref } from 'vue';
const text = ref('');
function send() {
if (!text.value.trim()) return;
// TODO: wire to your agent backend or MCA/MCP client.
console.log('[chat] send:', text.value);
text.value = '';
}
</script>


<template>
<section class="card">
<label class="label">Chat</label>
<textarea v-model="text" placeholder="Type a message…" />
<div class="row">
<button class="btn" @click="send">Send</button>
<span class="hint">Supports popover for selection (stub)</span>
</div>
</section>
</template>


<style scoped>
.card { border: 1px solid rgba(0,0,0,.1); border-radius: 12px; padding: 10px; display:flex; flex-direction: column; gap: 8px; }
.label { font-weight: 600; }
textarea { min-height: 80px; resize: vertical; padding: 8px; border-radius: 8px; border: 1px solid rgba(0,0,0,.2); }
.row { display:flex; align-items:center; justify-content: space-between; }
.btn { border: 1px solid rgba(0,0,0,.15); background: transparent; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
.hint { font-size: 12px; opacity: .6; }
</style>