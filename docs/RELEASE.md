# Distribuição e publicação

O projeto mantém o mesmo histórico em [GitHub](https://github.com/BrunoF2P/Imglyze) e [GitLab](https://gitlab.com/BrunoF2P/imglyze). O GitHub Actions usa runners hospedados; o GitLab usa Docker para Linux e runners próprios para Windows e macOS.

## CI nas duas plataformas

Pushes em `main`, pull requests/merge requests e tags executam TypeScript, Vitest, build web, rustfmt, Clippy e testes Rust. Os scripts de release também têm testes: versões divergentes, instaladores ausentes ou duplicados e releases incompletas bloqueiam o pipeline.

As actions do GitHub estão fixadas por SHA. Apenas o job de release possui permissão de escrita; os testes de pull requests não recebem os certificados de distribuição.

## Preparar uma versão

1. Atualize a versão em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`, mantendo os lockfiles pelas ferramentas npm/Cargo.
2. Atualize [as notas de versão](RELEASE_NOTES.md) e execute as verificações descritas no README.
3. Faça o commit e envie a branch para ambos os remotes:

   ```sh
   npm run repo:push
   ```

4. Crie uma tag correspondente à versão do aplicativo e envie para as duas plataformas. Exemplo para a versão atual:

   ```sh
   git tag -a v0.1.0 -m "Imglyze v0.1.0"
   npm run repo:push -- v0.1.0
   ```

`origin` aponta para o GitLab e `github` para o GitHub. O script envia a mesma referência sequencialmente, sem force push. Se o segundo envio falhar, corrija o acesso e execute novamente; o primeiro envio será reconhecido como atualizado. Não existe espelhamento automático de commits feitos diretamente pelas interfaces web.

## Instaladores e publicação

Após as verificações, as tags geram seis instaladores:

| Sistema | Arquitetura | Arquivos |
| :--- | :--- | :--- |
| Linux | x64 | AppImage, DEB e RPM |
| Windows | x64 | MSI e NSIS (`.exe`) |
| macOS | Universal: Intel e Apple Silicon | DMG |

Os arquivos recebem um prefixo por plataforma para evitar colisões entre os jobs. A publicação exige os seis instaladores e gera `SHA256SUMS.txt` com seus hashes SHA-256.

- **GitHub:** cria um rascunho de release com os instaladores, hashes e notas. Reexecuções podem atualizar esse rascunho, mas recusam substituir os arquivos de uma release já publicada. Depois de instalar e conferir os pacotes, publique o rascunho na página Releases.
- **GitLab:** guarda os instaladores como artefatos por 30 dias. O job manual `release` publica os arquivos no Generic Package Registry e cria a release, sem depender de links para artefatos que expiram. Uma release existente não é sobrescrita.

Os pipelines não criam tags durante o desenvolvimento e não publicam uma versão final automaticamente.

## Decoder AVIF incluído

`npm run release:build` compila dav1d 1.5.4 estático antes do Tauri para evitar exigir uma instalação desse decoder no computador do usuário. Requer Git, Python 3, Meson, Ninja, NASM, pkg-config e compilador C. A primeira execução baixa o código do VideoLAN. As dependências do sistema do Tauri continuam necessárias.

No macOS, o decoder é compilado para Intel e ARM e combinado com `lipo`. No Windows, Meson usa o ambiente MSVC. O GitHub prepara essas ferramentas nos respectivos runners. O Linux hospedado usa Ubuntu 24.04; confirme a compatibilidade dos pacotes nas distribuições que pretende suportar.

## Assinatura e segredos

Sem certificados, Windows gera instaladores sem assinatura de publicador e macOS usa assinatura ad hoc, sem notarização Apple. Esses pacotes podem receber alertas ou bloqueios do sistema. Para exigir assinatura completa, configure a variável `RELEASE_REQUIRE_SIGNING=true`; os builds recusam continuar se faltar algum segredo obrigatório.

### GitHub Actions

Cadastre em **Settings → Secrets and variables → Actions**:

| Plataforma | Secrets |
| :--- | :--- |
| Windows | `WINDOWS_CERTIFICATE`: PFX em base64; `WINDOWS_CERTIFICATE_PASSWORD`: senha do PFX. |
| macOS | `APPLE_CERTIFICATE`: P12 em base64; `APPLE_CERTIFICATE_PASSWORD`; `APPLE_SIGNING_IDENTITY`; `APPLE_ID`; `APPLE_PASSWORD`: senha específica de aplicativo; `APPLE_TEAM_ID`. |

O certificado Windows é importado no repositório de certificados do usuário do runner; o arquivo PFX temporário é removido. O Tauri usa SHA-256 e timestamp DigiCert. No macOS, o Tauri realiza assinatura e notarização com as credenciais Apple. Configurações Apple parciais são recusadas.

A criação da release GitHub usa o `GITHUB_TOKEN` do próprio job, sem token pessoal adicional.

### GitLab CI

- **Linux:** runner Docker; o job instala as dependências em Rust/Debian Trixie.
- **Windows:** runner com tag `windows`, Node 24, Rust MSVC, Visual Studio Build Tools (C++), Windows SDK com SignTool, Python, Meson, Ninja, NASM e pkg-config no PATH.
- **macOS:** runner com tag `macos`, Node 24, Rust, Xcode Command Line Tools, Python, Meson, Ninja, NASM e pkg-config.

Cadastre as variáveis Apple como protegidas e mascaradas. Para Windows, instale o certificado e a chave privada no repositório de certificados do usuário do runner e defina `WINDOWS_CERTIFICATE_THUMBPRINT`. Proteja as tags de release para que recebam os segredos.

A publicação usa `GLAB_ENABLE_CI_AUTOLOGIN=true` com o `CI_JOB_TOKEN`. Se a instância exigir outro acesso, configure um `GITLAB_TOKEN` protegido com escopo `api`. Não atribua o job token à variável `GITLAB_TOKEN`: eles usam formas diferentes de autenticação.

## Validação antes de distribuir

Instale os pacotes em máquinas limpas de cada sistema. Verifique AVIF de entrada/saída, importação de pasta/ZIP, caminhos com espaços e acentos, prévia, cancelamento, notificação, assinatura Windows e notarização macOS quando configuradas. Verifique as duas arquiteturas do DMG e o AppImage em uma distribuição suportada.

A configuração do pipeline não comprova que os seis pacotes foram gerados, assinados ou instalados com sucesso. Registre os resultados da execução e dos testes nativos antes de publicar a release final.

Referências: [GitHub Actions com Tauri](https://v2.tauri.app/distribute/pipelines/github/), [assinatura Windows](https://v2.tauri.app/distribute/sign/windows/), [assinatura macOS](https://v2.tauri.app/distribute/sign/macos/), [publicação com glab](https://docs.gitlab.com/cli/release/create/).
