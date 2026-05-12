<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";

import type { UserProfileDetail } from "@/api/types";
import { uploadProfileImages } from "@/api/uploads";
import { fetchMyProfile, patchMyProfile } from "@/api/user";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const uploadBusy = ref(false);
const fileRef = ref<HTMLInputElement | null>(null);

const form = reactive({
  nickname: "",
  avatar: "",
  gender: null as string | null,
  birthday: null as string | null,
  bio: "",
  address: "",
  company: "",
  jobTitle: "",
  isMarried: null as boolean | null,
  mom: "",
  father: "",
  university: "",
});

function applyDetail(p: UserProfileDetail | null) {
  form.nickname = p?.nickname ?? "";
  form.avatar = p?.avatar ?? "";
  form.gender = p?.gender ?? null;
  form.birthday = p?.birthday ?? null;
  form.bio = p?.bio ?? "";
  form.address = p?.address ?? "";
  form.company = p?.company ?? "";
  form.jobTitle = p?.jobTitle ?? "";
  form.isMarried = p?.isMarried ?? null;
  form.mom = p?.mom ?? "";
  form.father = p?.father ?? "";
  form.university = p?.university ?? "";
}

onMounted(async () => {
  loading.value = true;
  try {
    const { profile } = await fetchMyProfile();
    applyDetail(profile);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    await router.push({ name: "profile" });
  } finally {
    loading.value = false;
  }
});

async function onAvatarFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files?.length) return;
  uploadBusy.value = true;
  try {
    const { urls } = await uploadProfileImages(Array.from(files));
    if (urls[0]) {
      form.avatar = urls[0];
      ElMessage.success("头像已上传，保存后生效");
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "上传失败");
  } finally {
    uploadBusy.value = false;
    input.value = "";
  }
}

function pickAvatar() {
  fileRef.value?.click();
}

async function onSubmit() {
  saving.value = true;
  try {
    const payload = {
      nickname: form.nickname.trim() || null,
      avatar: form.avatar.trim() || null,
      gender: form.gender,
      birthday: form.birthday,
      bio: form.bio.trim() || null,
      address: form.address.trim() || null,
      company: form.company.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
      isMarried: form.isMarried,
      mom: form.mom.trim() || null,
      father: form.father.trim() || null,
      university: form.university.trim() || null,
    };
    await patchMyProfile(payload);
    await auth.fetchProfile();
    const { profile } = await fetchMyProfile();
    applyDetail(profile);
    ElMessage.success("保存成功");
    await router.push({ name: "profile" });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-loading="loading" class="mine profile-edit">
    <div class="toolbar">
      <h1>编辑资料</h1>
      <el-button @click="router.push({ name: 'profile' })">返回</el-button>
    </div>
    <el-form label-width="100px" class="form">
      <el-form-item label="昵称">
        <el-input v-model="form.nickname" maxlength="100" show-word-limit placeholder="选填" />
      </el-form-item>
      <el-form-item label="头像">
        <div class="avatar-row">
          <input
            ref="fileRef"
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,image/gif,image/webp"
            @change="onAvatarFile"
          />
          <el-button :loading="uploadBusy" @click="pickAvatar">上传头像</el-button>
          <el-input v-model="form.avatar" placeholder="或粘贴图片 URL" />
        </div>
      </el-form-item>
      <el-form-item label="性别">
        <el-select v-model="form.gender" clearable placeholder="选填" style="width: 200px">
          <el-option label="男" value="male" />
          <el-option label="女" value="female" />
          <el-option label="不便透露" value="unknown" />
        </el-select>
      </el-form-item>
      <el-form-item label="生日">
        <el-date-picker
          v-model="form.birthday"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选填"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="个人简介">
        <el-input v-model="form.bio" type="textarea" :rows="4" maxlength="2000" show-word-limit />
      </el-form-item>
      <el-form-item label="住址">
        <el-input v-model="form.address" maxlength="255" />
      </el-form-item>
      <el-form-item label="公司">
        <el-input v-model="form.company" maxlength="255" />
      </el-form-item>
      <el-form-item label="职称">
        <el-input v-model="form.jobTitle" maxlength="255" />
      </el-form-item>
      <el-form-item label="婚姻状况">
        <el-select v-model="form.isMarried" clearable placeholder="选填" style="width: 200px">
          <el-option label="已婚" :value="true" />
          <el-option label="未婚" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="母亲">
        <el-input v-model="form.mom" maxlength="255" />
      </el-form-item>
      <el-form-item label="父亲">
        <el-input v-model="form.father" maxlength="255" />
      </el-form-item>
      <el-form-item label="大学">
        <el-input v-model="form.university" maxlength="255" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.profile-edit {
  padding: 20px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.toolbar h1 {
  margin: 0;
  font-size: 18px;
}

.form {
  max-width: 720px;
}

.avatar-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}
</style>
