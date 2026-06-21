<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { useDark } from '@vueuse/core';

useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'ion-palette-dark dark',
  valueLight: '',
});
</script>
