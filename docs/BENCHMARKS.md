# Benchmark reproduzível

O exemplo usa o mesmo pipeline Rust de codificação, redimensionamento e SSIM do aplicativo. Executa um worker e depois até oito CPUs físicas, respeitando o orçamento estimado de memória de 768 MiB. Ele mede o motor; não mede importação, miniaturas, interface ou empacotamento ZIP.

```sh
cargo run --release --manifest-path src-tauri/Cargo.toml --example benchmark -- --fixture .build/corpus
cargo run --release --manifest-path src-tauri/Cargo.toml --example benchmark -- --folder /caminho/do/corpus
```

A fixture gera 12 PNGs determinísticos de 1024 × 768 com gradientes e bordas. É útil para regressão; não representa uma coleção fotográfica. O modo fixture também grava `comparison.webp`, excluído das medições seguintes. No modo pasta, use um diretório só de entradas. A configuração é WebP 80, tamanho original, sem metadata, SSIM habilitado. O JSON contém as configurações e os resultados.

## Medição local preliminar

Execução de 13/10/2026 em Linux x86_64, oito CPUs físicas, **perfil debug**, uma execução por configuração. Resultado bruto: [local-debug.json](benchmarks/local-debug.json).

| Workers | Tempo | Entrada | Saída | SSIM médio |
| --- | ---: | ---: | ---: | ---: |
| 1 | 17,404 s | 1.337.896 B | 116.706 B | 89,87% |
| 8 | 2,969 s | 1.337.896 B | 116.706 B | 89,87% |

A razão observada foi 5,86×. O aquecimento e a ordem fixa podem favorecer a segunda execução. Não extrapole para outros formatos, máquinas, fotografias ou lotes. O GIF e a comparação na página local usam a primeira imagem desse corpus e a saída real do motor.

## Comparação com concorrentes

Não há medições de Caesium nem ImageOptim nesta execução. Para preencher a tabela, fixe versões, máquina, sistema, corpus e configuração; publique hashes SHA-256 das entradas, tamanho das saídas e métricas junto aos tempos. Compare configurações com qualidade visual semelhante, e não apenas o mesmo número de qualidade dos encoders. ImageOptim exige macOS para uma comparação direta na mesma máquina.

Faça cinco repetições depois de aquecer cada ferramenta, alterne a ordem e reporte mediana, mínimo/máximo e pico de RSS. Separe importação, processamento e exportação. Use fotografias 4K/8K, imagens com transparência, screenshots e desenhos. Teste PNG, JPEG, WebP e AVIF separadamente, com e sem resize e SSIM.

| Ferramenta | Versão | Corpus fotográfico | Mediana / RSS | Estado |
| --- | --- | --- | --- | --- |
| Imglyze release | a registrar | a registrar | a medir | pendente |
| Caesium | a registrar | mesmo corpus | a medir | pendente |
| ImageOptim (macOS) | a registrar | mesmo corpus | a medir | pendente |

SSIM é um indicador aproximado de luminância, calculado após resize, com imagem limitada a 512 px. Não mede percepção humana completa, fidelidade de cor ou transparência, nem garante um percentual de qualidade preservada.
