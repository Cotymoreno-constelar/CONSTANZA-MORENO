/**
 * DIVO 20 Años - Admin Authentication Service
 * Manages access control, password verification, session persistence, and custom password updates.
 */

const DEFAULT_ADMIN_PASSWORD = 'DIVO2026';
const PASSWORD_STORAGE_KEY = 'divo_admin_custom_password_v1';
const SESSION_AUTH_KEY = 'divo_admin_session_active_v1';
const REMEMBER_AUTH_KEY = 'divo_admin_remember_device_v1';

export class AuthService {
  /**
   * Get the current configured admin password
   */
  public static getAdminPassword(): string {
    try {
      const custom = localStorage.getItem(PASSWORD_STORAGE_KEY);
      if (custom && custom.trim().length >= 4) {
        return custom.trim();
      }
    } catch {
      // fallback to default
    }
    return DEFAULT_ADMIN_PASSWORD;
  }

  /**
   * Checks if an admin session is currently authenticated
   */
  public static isAuthenticated(): boolean {
    try {
      // Check localStorage for "remember me"
      const remembered = localStorage.getItem(REMEMBER_AUTH_KEY);
      if (remembered === 'true') {
        return true;
      }

      // Check current session
      const session = sessionStorage.getItem(SESSION_AUTH_KEY);
      if (session === 'true') {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Attempt login with password
   */
  public static login(password: string, rememberDevice: boolean = false): { success: boolean; error?: string } {
    const currentPassword = this.getAdminPassword();
    const cleanInput = (password || '').trim();

    if (cleanInput === currentPassword) {
      try {
        sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
        if (rememberDevice) {
          localStorage.setItem(REMEMBER_AUTH_KEY, 'true');
        } else {
          localStorage.removeItem(REMEMBER_AUTH_KEY);
        }
      } catch {
        // ignore
      }
      return { success: true };
    }

    return {
      success: false,
      error: 'Clave incorrecta. Por favor verifica e intenta nuevamente.',
    };
  }

  /**
   * Log out and clear all admin credentials
   */
  public static logout(): void {
    try {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      localStorage.removeItem(REMEMBER_AUTH_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * Update the admin password
   */
  public static changePassword(currentPasswordInput: string, newPassword: string): { success: boolean; error?: string } {
    const activePassword = this.getAdminPassword();
    if (currentPasswordInput.trim() !== activePassword) {
      return { success: false, error: 'La clave actual ingresada no es correcta.' };
    }

    const cleanNew = newPassword.trim();
    if (cleanNew.length < 4) {
      return { success: false, error: 'La nueva clave debe tener al menos 4 caracteres.' };
    }

    try {
      localStorage.setItem(PASSWORD_STORAGE_KEY, cleanNew);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'No se pudo guardar la nueva clave en este navegador.' };
    }
  }

  /**
   * Reset password back to default
   */
  public static resetToDefault(): void {
    try {
      localStorage.removeItem(PASSWORD_STORAGE_KEY);
    } catch {}
  }
}
