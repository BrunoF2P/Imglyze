# Imglyze 0.1.0

Otimização, conversão e redimensionamento de imagens em lote, com processamento local.

## Novidades

- Entrada AVIF e SVG rasterizado, com exportação AVIF.
- Processamento paralelo e redimensionamento SIMD com controle de proporção.
- Presets nomeados, configurações persistidas e prévia de uma amostra.
- Comparação com zoom e slider; carregamento e erros de prévia visíveis.
- Fila virtualizada com busca, filtros e ordenação por economia.
- Interface com a identidade visual do projeto, temas claro/escuro e configurações em abas.
- Exportação em pasta ou ZIP, proteção contra colisões e gravação atômica.
- Indicador SSIM opcional e notificações de conclusão em segundo plano.

## Instaladores

Windows x64 (MSI/NSIS), Linux x64 (AppImage/DEB/RPM) e macOS universal (DMG para Intel e Apple Silicon). A release inclui hashes em `SHA256SUMS.txt`.

Assinatura de publicador Windows e notarização Apple dependem dos certificados configurados no pipeline. Pacotes sem esses certificados podem exibir alertas ou ser bloqueados pelo sistema.

## Pontos de atenção

Qualidade 100 representa qualidade máxima; JPEG e AVIF continuam usando compressão com perdas. O SSIM é uma aproximação, e o tamanho desejado pode não ser atingido. A substituição de originais não oferece backup permanente. Consulte o README e `docs/BENCHMARKS.md` para limites e metodologia.
