/**
 * Acesso ao painel /acesso-dev  (verificado no servidor)
 * A senha fica guardada só como SHA-256 (não em texto).
 * Trocar senha: gere o SHA-256 da nova senha (ex: https://emn178.github.io/online-tools/sha256.html)
 *               e substitua senha_sha256.
 * Destravar após 3 erros: troque "destravar" por outro valor ('v2', 'v3'...) e faça deploy.
 */
module.exports = {
  usuario: 'acessodev',
  senha_sha256: '44f57792c81f53acf317979eba10001f7714319b3df360d8c1d0ba0bc6943fb8',
  max_tentativas: 3,
  destravar: 'v1',
  sessao_horas: 12,
};
