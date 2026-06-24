<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon aria-hidden="true" :icon="libraryOutline" />
          <ion-label>书架</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="insights" href="/tabs/insights">
          <ion-icon aria-hidden="true" :icon="statsChartOutline" />
          <ion-label>洞察</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="profile" href="/tabs/profile">
          <ion-icon aria-hidden="true" :icon="personOutline" />
          <ion-label>我的</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { libraryOutline, statsChartOutline, personOutline } from 'ionicons/icons';
</script>
