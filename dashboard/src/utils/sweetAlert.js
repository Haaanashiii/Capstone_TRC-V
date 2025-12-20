import Swal from 'sweetalert2';

/**
 * SweetAlert2 utility for consistent alerts across the application
 */

const defaultStyles = {
  confirmButtonColor: '#174D7A',
  cancelButtonColor: '#6c757d',
  background: '#fff',
  color: '#333',
  fontFamily: 'Poppins, sans-serif',
  customClass: {
    container: 'swal-container'
  },
  didOpen: (modal) => {
    modal.style.zIndex = '9999';
  }
};

export const showSuccess = (message, title = 'Success!') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    ...defaultStyles,
    confirmButtonText: 'OK'
  });
};

export const showError = (message, title = 'Error!') => {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    ...defaultStyles,
    confirmButtonText: 'OK'
  });
};

export const showWarning = (message, title = 'Warning!') => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    ...defaultStyles,
    confirmButtonText: 'OK'
  });
};

export const showInfo = (message, title = 'Information') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    ...defaultStyles,
    confirmButtonText: 'OK'
  });
};

export const showConfirm = async (message, title = 'Are you sure?') => {
  const result = await Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: 'Yes',
    cancelButtonText: 'No',
    ...defaultStyles
  });
  return result.isConfirmed;
};

export const showCustom = (options) => {
  return Swal.fire({
    ...defaultStyles,
    ...options
  });
};

// For toast notifications (small, auto-dismiss)
export const showToast = (message, icon = 'success') => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: {
      container: 'swal-container'
    },
    didOpen: (toast) => {
      toast.style.zIndex = '9999';
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  return Toast.fire({
    icon,
    title: message
  });
};

export default {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  confirm: showConfirm,
  custom: showCustom,
  toast: showToast
};
