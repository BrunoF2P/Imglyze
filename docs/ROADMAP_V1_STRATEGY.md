# Documento Estratégico & Roadmap de Produto: Imglyze v1.0 (Final)

> **Missão:** Tornar o **Imglyze** a ferramenta desktop open-source definitiva de otimização e conversão de imagens do mercado — unindo o poder visual e precisão do *Squoosh*, a simplicidade em lote do *Caesium/ImageOptim*, e a máxima performance nativa multi-core impulsionada por **Rust + Tauri 2**.

---

## 1. Análise de Mercado (Benchmarking Competitivo)

### Panorama dos Concorrentes Diretos

| Ferramenta | Pontos Fortes (Acertos) | Fraquezas e Falhas (Oportunidades para o Imglyze) |
| :--- | :--- | :--- |
| **Squoosh** (Google) | • Comparação lado a lado (slider) perfeita com zoom profundo.<br>• Controle granular de encoders modernos (MozJPEG, WebP, AVIF, OxiPNG). | • **Zero suporte a lote real**: Processa apenas 1 imagem por vez.<br>• Web/PWA: sofre limitações de memória do browser ao lidar com arquivos gigantescos. |
| **ImageOptim** | • Interface minimalista e arraste-e-solte.<br>• Enorme adesão no ecossistema Mac por ser limpo e confiável. | • **Exclusivo para macOS** (sem Windows/Linux).<br>• Quase 100% focado em *lossless* — não permite conversão flexível de formatos nem controle visual de qualidade lossy fina. |
| **Caesium Image Compressor** | • Excelente processamento em lote multiplataforma (Windows/Mac/Linux).<br>• Prévia lado a lado antes e depois.<br>• Suporta WebP, JPG, PNG. | • Interface em Qt datada com renderização pesada.<br>• Falta de zoom interativo de alta resolução (deep-zoom) no comparador.<br>• Não possui suporte nativo a AVIF de alta velocidade.<br>• Falta de automações modernas (presets salváveis por projeto, CLI complementar). |
| **FileOptimizer** | • Compressão super agressiva executando dezenas de ferramentas CLI encadeadas. | • **Apenas Windows**.<br>• Interface dos anos 90, extremamente complexa e intimidadora.<br>• Extremamente lento devido à falta de pipelines paralelos modernos e otimizados. |
| **TinyPNG / ShortPixel (SaaS)** | • Algoritmos proprietários de quantização muito populares. | • **Requer envio de fotos para a nuvem** (risco de privacidade para empresas/fotógrafos).<br>• Cobrança por volume/assinatura, limite rígido de MB por upload. |

---

## 2. Diagnóstico do Imglyze: Nossos Acertos vs. Nossas Falhas Atuais

### 🏆 Nossos Maiores Acertos (Diferenciais Competitivos)
1. **Stack Tecnológica de Elite (Rust 2021 + Tauri 2 + React 19 + Tailwind v4):**
   * Pegada de memória minúscula (< 50MB RAM), sem o peso do Electron (~200MB+).
   * Encoders de altíssima eficiência nativa compilados em C/Rust: `mozjpeg`, `oxipng`, `webp`, `imagequant`.
2. **Visualizador de Inspeção Avançado:**
   * Integração com **OpenSeadragon** para deep zoom no comparador lado a lado — isso nos coloca no mesmo patamar visual do Squoosh, algo que nenhum app de batch tem com essa fluidez.
3. **Privacidade e Desempenho Local Total (Zero Cloud):**
   * Todas as fotos são processadas no hardware local, sem telemetria invasiva ou envio de dados.
4. **Suporte Completo a Estrutura de Lote:**
   * Processamento de arquivos soltos, pastas recursivas preservando hierarquia e suporte direto a entrada/saída em arquivos `.zip`.

---

### ⚠️ Nossas Falhas e Lacunas Críticas para Fechar a v1.0

| Área | Situação Atual | O que falta para sermos os melhores |
| :--- | :--- | :--- |
| **Paralelismo no Lote** | O loop `batch_processor.rs` executa os arquivos de forma **sequencial** (`for mut item in items`), gerando uma tarefa bloqueante por vez. | **Processamento Paralelo Real com Rayon/Tokio**: Usar todas as threads da CPU com um pool de workers (ex: processar 8 a 16 imagens simultaneamente com limite de memória). |
| **Formatos Modernos** | Suporta JPG, PNG, WebP e BMP. | **Falta suporte a AVIF e SVG**: AVIF hoje é o padrão ouro de compressão web (superando WebP em 20-30%). |
| **Redimensionamento (Resize)** | O app comprime e quantiza, mas não tem ferramenta de redimensionamento em lote. | Adicionar opção de redimensionar: por escala (%), por resolução máxima (largura/altura) e manter aspect ratio. Essencial para web designers. |
| **Métricas de Qualidade (SSIM / PSNR)** | A comparação visual depende apenas do olho humano. | Apresentar métrica visual numérica objetiva (ex: **SSIM score** 0.98 ou 98% de fidelidade visual calculada em Rust). |
| **Presets Personalizados** | Apenas presets fixos codificados (*balanced*, *high_quality*, *lossless*). | Permitir que o usuário **crie, edite e salve seus próprios presets** nomeados (ex: "E-commerce 1200px", "Banner Retina"). |
| **Visualizador de Comparação Direta** | Modal de comparação atual exige processar ou abrir após seleção. | Capacidade de inspecionar uma prévia antes de mandar rodar o lote de centenas de imagens. |
| **Polimento de Empacotamento / Releases** | O app funciona em modo de desenvolvimento, mas faltam pipelines de release assinado para Windows (`.msi` / `.exe`), macOS (`.dmg`) e Linux (`.AppImage` / `.deb`). | Configurar o CI/CD (GitHub Actions / GitLab CI) para gerar os binários automáticos da versão final. |

---

## 3. A Fórmula para Ser o Número 1 do Segmento

Para ser a melhor ferramenta do mercado, o Imglyze precisa vencer a tríade:

```
          [ MÁXIMA VELOCIDADE ]
         (Rust Multi-Core Rayon)
                  /\
                 /  \
                /    \
               /      \
  [ FIDELIDADE VISUAL ]-----[ EXPERIÊNCIA DE USO ]
   (MozJPEG, OxiPNG, AVIF,   (Design moderno, Drag&Drop,
     SSIM & OpenSeadragon)    Presets custom, Cross-platform)
```

1. **Mais rápido que o Caesium e ImageOptim** (aproveitando 100% dos núcleos da CPU sem travar a interface).
2. **Melhor experiência de comparação que o Squoosh**, trazendo a inspeção detalhada para dentro de uma fila em lote.
3. **100% grátis, sem anúncios, sem telemetria e com código aberto auditável.**

---

## 4. Roadmap Passo a Passo para a Versão Final (v1.0.0)

### 📍 Fase 1: Motor de Alta Performance & Multi-Core (Rust)
- [x] **Processamento Paralelo em Lote:**
  - Substituir o loop sequencial por um pool de execução paralela controlada (utilizando `rayon` ou `tokio::task::JoinSet` limitado ao número de CPUs físicas para evitar estouro de RAM).
- [x] **Métricas de Fidelidade (SSIM / DSSIM):**
  - Implementar cálculo rápido de SSIM entre a imagem de entrada e saída para mostrar ao usuário um indicador de qualidade percentual real (ex: "Fidelidade: 99.2%").
- [x] **Suporte ao formato AVIF:**
  - Integrar encoder `ravif` / `libavif` no backend Rust para permitir exportação no formato mais moderno da web.

---

### 📍 Fase 2: Funcionalidades Essenciais do Usuário (Frontend + Backend)
- [x] **Motor de Redimensionamento em Lote (Image Resizing):**
  - Modos: "Tamanho original", "Ajustar à largura/altura máxima (Fit)", "Percentual (Ex: 50%)".
  - Filtro de interpolação de alta qualidade (Lanczos3 / Catmull-Rom).
- [x] **Gerenciador de Presets Personalizados:**
  - Criar interface para salvar configurações customizadas no store local (`settings.json`).
  - Botão "Salvar Preset Atual" e menu dropdown para alternar rapidamente entre fluxos de trabalho.
- [x] **Prévia Instantânea de Amostra:**
  - Permitir que o usuário gere a prévia de apenas 1 imagem selecionada com os ajustes atuais antes de rodar o lote completo de 500 imagens.

---

### 📍 Fase 3: Refinamento de UI, Feedback e Acessibilidade
- [x] **Melhorias na Fila de Arquivos:**
  - Filtro e busca na tabela de imagens.
  - Ordenação por economia de espaço (maior redução em MB / %), tamanho ou nome.
  - Botão de "Abrir pasta de destino" ou "Revelar no explorador de arquivos" ao concluir.
- [x] **Tratamento de Notificações Nativas do SO:**
  - Disparar notificação nativa do sistema operacional (via plugin de notificação do Tauri) quando um lote longo for concluído em segundo plano.

---

### 📍 Fase 4: Automação, Empacotamento e Lançamento (Release v1.0.0)
- [ ] **Builds de Produção Automatizados — configuração implementada; execução externa pendente:**
  - Workflow de release gerando instaladores:
    - **Windows:** `.msi` e instalador `.exe` (NSIS).
    - **macOS:** `.dmg` (Universal binary para Intel e Apple Silicon).
    - **Linux:** `.AppImage`, `.deb` e `.rpm`.
- [ ] **Documentação & Landing Page — página, README e GIF implementados; benchmarks competitivos e gravação desktop pendentes:**
  - Atualização do README com benchmarks de velocidade contra o Caesium e ImageOptim.
  - Gravação de GIF/vídeo de demonstração interativo.


## Estado da implementação em 13/10/2026

Os itens marcados acima representam código e configuração implementados. O paralelismo usa Tokio JoinSet, sem acrescentar um segundo pool Rayon. Não foi incluído acesso ao filesystem pelo frontend: operações ficam nos comandos Rust, sem necessidade do plugin-fs.

O README, benchmark reproduzível, página local e GIF de comparação foram adicionados. A comparação interativa e o GIF usam uma saída real do motor sobre um corpus sintético; o GIF não é uma gravação da aplicação desktop. A medição local é de desenvolvimento e não comprova liderança frente aos concorrentes.

Ainda exigem execução externa antes do lançamento:

- [ ] Executar o pipeline nos runners Windows/macOS/Linux e instalar os seis pacotes em máquinas limpas.
- [ ] Validar certificados, assinatura Windows, DMG universal e notarização Apple.
- [ ] Medir builds de produção com corpus fotográfico e comparar com Caesium e ImageOptim na mesma máquina.
- [ ] Gravar o fluxo completo no aplicativo desktop nativo e publicar a página/releases, quando autorizado.

Consulte [RELEASE.md](RELEASE.md) e [BENCHMARKS.md](BENCHMARKS.md). Estimativas e afirmações competitivas do documento estratégico original são hipóteses, não resultados validados desta implementação.
