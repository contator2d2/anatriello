export const getPos = () =>
  new Promise<{ lat?: number; lng?: number }>((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

export const pickPhoto = (): Promise<string | null> =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    (input as any).capture = "environment";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(f);
    };
    input.click();
  });
