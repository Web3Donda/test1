function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadProductImage(file: File): Promise<string> {
  const dataBase64 = await fileToBase64(file);
  const token = localStorage.getItem('adminToken') || '';
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      dataBase64,
    }),
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('adminToken');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Сервер вернул ${res.status}`);
  }
  const { url } = await res.json();
  if (!url) throw new Error('Сервер не вернул ссылку на изображение.');
  return url;
}
