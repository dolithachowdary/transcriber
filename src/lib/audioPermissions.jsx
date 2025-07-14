
export const handleMicrophoneAccess = async (toast) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (error) {
    console.error("Error accessing microphone:", error);
    let description = "Could not access microphone. Please check permissions.";
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      description = "Microphone access denied. Please enable it in your browser settings.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      description = "No microphone found. Please ensure one is connected and enabled.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      description = "Microphone is already in use or cannot be accessed. Try closing other apps using the microphone.";
    }
    toast({
      variant: "destructive",
      title: "Microphone Error",
      description: description,
    });
    return null;
  }
};
