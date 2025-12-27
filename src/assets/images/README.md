# Images Directory

This directory contains image assets used throughout the application.

## Contents

- **Background images** - Used for login page and other page backgrounds
- **Icons and logos** - Application branding and UI icons
- **Other static images** - Any other images needed by the application

## Usage

Import images in Vue components:

```vue
<script setup lang="ts">
import backgroundImage from '@/assets/images/login-background.jpg'
</script>

<template>
  <div :style="{ backgroundImage: `url(${backgroundImage})` }">
    <!-- content -->
  </div>
</template>
```

Or use in CSS:

```css
.login-page {
  background-image: url('@/assets/images/login-background.jpg');
  background-size: cover;
  background-position: center;
}
```
