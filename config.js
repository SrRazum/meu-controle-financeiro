// Configuração do Supabase — sem interferência no boot do aplicativo.
// A proteção local é independente da nuvem. O Supabase só deve ser usado
// pelas funções de sincronização depois que o usuário estiver desbloqueado.
(function () {
  'use strict';

  window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
  window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

  // Compatibilidade com versões que consultam a configuração por objeto.
  window.FINANCE_CONFIG = {
    supabaseUrl: window.SUPABASE_URL,
    supabasePublishableKey: window.SUPABASE_PUBLISHABLE_KEY
  };

  // IMPORTANTE: não redefinir window.supabase, não criar getters/setters,
  // não bloquear o CDN e não iniciar sincronização durante o carregamento.
  // O fluxo correto é:
  // carregamento -> proteção local -> desbloqueio -> aplicativo -> sincronização.
})();
