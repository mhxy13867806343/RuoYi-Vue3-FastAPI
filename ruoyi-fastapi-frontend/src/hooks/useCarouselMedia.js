import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { uploadMedia } from '@/api/h5/carousel';

export default function useCarouselMedia(form) {
  // 确保表单的mediaList字段初始化
  const ensureMediaList = () => {
    if (!form.value) {
      form.value = {};
    }
    if (!form.value.mediaList) {
      form.value.mediaList = [];
    }
  };

  // 待上传的文件列表（只在提交表单时才真正上传）
  const pendingUploadFiles = ref([]);

  // 上传进度
  const uploadProgress = ref({});

  // 模拟上传进度
  const simulateUploadProgress = (fileId) => {
    uploadProgress.value[fileId] = 0;
    const interval = setInterval(() => {
      if (uploadProgress.value[fileId] < 100) {
        uploadProgress.value[fileId] += 10;
      } else {
        clearInterval(interval);
      }
    }, 300);
  };

  // 文件上传前的校验
  const beforeUpload = (file) => {
    // 检查文件大小
    const isLt10M = file.size / 1024 / 1024 < 50;
    if (!isLt10M) {
      ElMessage.error('文件大小不能超过 50MB!');
      return false;
    }

    // 检查文件类型
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      ElMessage.error('只能上传图片或视频文件!');
      return false;
    }

    return true;
  };

  // 处理超出文件数量限制
  const handleExceed = (files) => {
    ensureMediaList();
    console.log('handleExceed', files);
    // 当选择的文件超过限制时，我们仍然处理它们，但只取前面的部分
    const remainingSlots = 9 - form.value.mediaList.length;
    if (remainingSlots <= 0) {
      ElMessage.warning('已达到最大上传数量9个，无法继续添加');
      return;
    }

    // 只处理能够添加的文件数量
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    // 处理每个文件
    filesToProcess.forEach(file => {
      // 创建一个类似el-upload组件生成的file对象
      const uploadFile = {
        raw: file,
        name: file.name,
        size: file.size,
        status: 'ready',
        uid: Date.now() + '_' + Math.random().toString(36).substr(2, 10)
      };
      processFile(uploadFile);
    });
  };

  // 检查文件数量限制
  const checkFileLimit = () => {
    ensureMediaList();
    if (form.value.mediaList.length >= 9) {
      ElMessage.warning('已达到最大上传数量9个，无法继续添加');
      return false;
    }
    return true;
  };

  // 处理文件变化事件
  const handleFileChange = (file, fileList) => {
    ensureMediaList();

    // 如果是删除操作，不处理
    if (!file || !file.raw) {
      return;
    }

    console.log('文件变化:', file.name, '当前媒体列表长度:', form.value.mediaList.length);

    // 如果已经有9个或以上的文件，则不再添加
    if (form.value.mediaList.length >= 9) {
      ElMessage.warning('已达到最大上传数量9个，无法继续添加');
      return;
    }

    // 检查是否已经存在相同文件（根据文件名和大小）
    const isDuplicate = form.value.mediaList.some(item => 
      item.name === file.name && 
      (!item.size || item.size === file.raw.size)
    );
    
    if (isDuplicate) {
      ElMessage.warning(`文件 ${file.name} 已存在，请勿重复添加`);
      return;
    }

    // 直接处理当前文件
    processFile(file);
  };

  // 处理单个文件的上传和预览
  const processFile = (file) => {
    if (!file || !file.raw) return false;
    
    // 检查文件大小限制
    if (file.raw.size > 50 * 1024 * 1024) {
      ElMessage.error('文件大小不能超过50MB');
      return false;
    }
    
    // 检查文件类型
    const fileType = file.raw.type;
    const isVideo = fileType.startsWith('video/');
    const isImage = fileType.startsWith('image/');
    
    if (!isVideo && !isImage) {
      ElMessage.error(`不支持的文件类型: ${fileType}`);
      return false;
    }
    
    // 确保媒体列表已初始化
    ensureMediaList();
    
    // 检查是否已达到上限
    if (form.value.mediaList.length >= 9) {
      ElMessage.warning('最多只能上传9个文件');
      return false;
    }
    
    // 模拟上传进度
    simulateUploadProgress(file.uid);
    
    // 立即上传文件，获取真实URL
    uploadMedia(file.raw).then(response => {
      console.log('文件上传响应:', response);
      
      // 检查响应结构，获取文件URL
      let fileUrl = '';
      
      if (response && response.is_success && response.result) {
        if (response.result.url) {
          fileUrl = response.result.url;
        } else if (response.result.fileName) {
          fileUrl = response.result.fileName;
        }
      } else if (response && response.data) {
        if (typeof response.data === 'string') {
          fileUrl = response.data;
        } else if (response.data.url) {
          fileUrl = response.data.url;
        } else if (response.data.fileName) {
          fileUrl = response.data.fileName;
        }
      }
      
      if (!fileUrl) {
        console.warn('无法从响应中获取文件URL:', response);
        // 使用本地URL作为备用
        fileUrl = URL.createObjectURL(file.raw);
        ElMessage.warning(`文件 ${file.name} 上传成功，但无法获取URL，将使用临时URL`);
      }
      
      // 添加到媒体列表用于预览
      form.value.mediaList.push({
        uid: file.uid,
        name: file.name,
        url: fileUrl,
        type: isVideo ? 'video' : 'image',
        size: file.raw.size,
        externalLink: '',
        // 如果使用的是真实URL，则不需要保存原始文件对象
        file: fileUrl.startsWith('blob:') ? file.raw : null
      });

      console.log(`添加文件: ${file.name}, 类型: ${isVideo ? 'video' : 'image'}, URL: ${fileUrl}, 总数: ${form.value.mediaList.length}`);

      // 清除进度
      setTimeout(() => {
        delete uploadProgress.value[file.uid];
      }, 1000);
    }).catch(error => {
      console.error('文件上传失败:', error);
      ElMessage.error(`文件 ${file.name} 上传失败: ${error.message || '未知错误'}`);
      delete uploadProgress.value[file.uid];
    });
    
    return true;
  };

  // 移除媒体文件
  const removeMedia = (index) => {
    ensureMediaList();
    ElMessageBox.confirm('确定要删除这个媒体文件吗?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      // 从待上传列表中移除
      const uid = form.value.mediaList[index].uid;
      if (uid) {
        const fileIndex = pendingUploadFiles.value.findIndex(item => item.uid === uid);
        if (fileIndex !== -1) {
          pendingUploadFiles.value.splice(fileIndex, 1);
        }
      }

      // 从预览列表中移除
      form.value.mediaList.splice(index, 1);
      ElMessage.success('删除成功');
    }).catch(() => {
      // 取消删除
    });
  };

  // 实际上传文件（在表单提交时调用）
  const uploadFiles = async () => {
    ensureMediaList();
    
    // 过滤出需要上传的文件（仍然使用blob URL的文件）
    const filesToUpload = form.value.mediaList.filter(item => 
      item.file && item.url && item.url.startsWith('blob:')
    );
    
    if (filesToUpload.length === 0) {
      return Promise.resolve(form.value.mediaList);
    }

    try {
      const uploadPromises = filesToUpload.map(async (item) => {
        try {
          // 调用实际的上传API
          const response = await uploadMedia(item.file);
          console.log('文件上传响应:', response);
          
          // 检查响应结构，兼容不同的返回格式
          let fileUrl = '';
          
          // 处理后端返回的标准格式
          if (response && response.is_success && response.result) {
            if (response.result.url) {
              fileUrl = response.result.url;
            } else if (response.result.fileName) {
              fileUrl = response.result.fileName;
            }
          } 
          // 兼容其他可能的返回格式
          else if (response && response.data) {
            if (typeof response.data === 'string') {
              fileUrl = response.data;
            } else if (response.data.url) {
              fileUrl = response.data.url;
            } else if (response.data.fileName) {
              fileUrl = response.data.fileName;
            }
          }
          
          if (!fileUrl) {
            console.warn('无法从响应中获取文件URL:', response);
            return {
              ...item,
              uploadFailed: true
            };
          }
          
          // 更新媒体列表中的URL
          const index = form.value.mediaList.findIndex(media => media.uid === item.uid);
          if (index !== -1) {
            form.value.mediaList[index].url = fileUrl;
            form.value.mediaList[index].file = null; // 清除原始文件对象
          }
          
          // 返回上传结果
          return {
            ...item,
            url: fileUrl,
            file: null // 清除原始文件对象
          };
        } catch (error) {
          console.error('文件上传失败:', error);
          return {
            ...item,
            uploadFailed: true
          };
        }
      });

      // 等待所有文件上传完成
      const uploadResults = await Promise.all(uploadPromises);
      console.log('所有文件上传结果:', uploadResults);
      
      // 返回完整的媒体列表（包括已经有URL的和新上传的）
      return form.value.mediaList;
    } catch (error) {
      console.error('文件上传过程中发生错误:', error);
      ElMessage.error('文件上传失败: ' + (error.message || '未知错误'));
      return form.value.mediaList;
    }
  };

  // 重置媒体相关状态
  const resetMedia = () => {
    pendingUploadFiles.value = [];
    uploadProgress.value = {};
    ensureMediaList();
  };

  return {
    pendingUploadFiles,
    uploadProgress,
    beforeUpload,
    handleExceed,
    checkFileLimit,
    handleFileChange,
    processFile,
    removeMedia,
    uploadFiles,
    resetMedia
  };
}
