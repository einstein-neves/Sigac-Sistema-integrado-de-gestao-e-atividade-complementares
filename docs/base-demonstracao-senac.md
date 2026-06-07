# Base de demonstracao Senac

## Objetivo

Esta base controlada substitui grandes massas de teste por poucos registros coerentes para apresentar o SIGAC no PWA, mobile, paineis administrativos, OCR, relatorios e ML.

Os scripts preservam tabelas, migrations e estrutura do banco. O reset limpa apenas os dados das tabelas funcionais conhecidas.

> ATENCAO: nao execute o reset em producao sem backup validado.

## Fluxo recomendado

No PowerShell:

```powershell
npm run backup:demo
$env:RESET_CONFIRM="SIM"
npm run reset:demo
npm run seed:senac
```

Ou em um unico fluxo:

```powershell
$env:RESET_CONFIRM="SIM"
npm run prepare:presentation
```

O reset mostra o host e o nome do banco antes de limpar os dados. Sem `RESET_CONFIRM=SIM`, ele aborta. Em `NODE_ENV=production`, tambem exige `RESET_PRODUCTION_CONFIRM=SIM`.

O backup sanitizado e salvo em `exports/backup-sigac-AAAA-MM-DD-HH-mm.json`. Senhas, tokens e conteudos binarios sao removidos do arquivo.

Para validar toda a limpeza e o seed dentro de uma transacao que sera revertida:

```powershell
$env:SEED_DRY_RUN="SIM"
npm run seed:senac
Remove-Item Env:SEED_DRY_RUN
```

## Cursos cadastrados

| Sigla | Curso | Meta SIGAC |
| --- | --- | ---: |
| ADS | Analise e Desenvolvimento de Sistemas | 120h |
| JD | Jogos Digitais | 120h |
| TDS | Tecnico em Desenvolvimento de Sistemas | 100h |
| TII | Tecnico em Informatica para Internet | 100h |
| ADM | Tecnico em Administracao | 100h |
| RH | Tecnico em Recursos Humanos | 80h |
| LOG | Tecnico em Logistica | 80h |
| ST | Tecnico em Seguranca do Trabalho | 100h |
| ENF | Tecnico em Enfermagem | 120h |
| DI | Tecnico em Design de Interiores | 100h |
| RTV | Tecnico em Radio e Televisao | 100h |
| GT | Tecnico em Guia de Turismo | 80h |
| DJE | Desenvolvedor de Jogos Eletronicos | 40h |

A tabela atual de cursos nao possui colunas separadas para tipo, carga horaria total e duracao. Essas informacoes ficam registradas no campo `area`, sem alterar o esquema.

## Acessos de demonstracao

Todos usam a senha de teste `123456`.

| Perfil | Nome | E-mail |
| --- | --- | --- |
| Super Admin | Einstein | `admin@sigac.local` |
| Coordenador | Coordenador SIGAC | `coordenador@sigac.local` |
| Aluno | Einstein IB Neves | `einsteinbritoneves@gmail.com` |
| Aluno | Hilccer Rocha Araujo Melo | `hilccer@sigac.local` |
| Aluno | Izabel Santos | `izabel@sigac.local` |

O sistema atual usa o perfil interno `superadmin`; nao existe um perfil separado chamado `admin`.

## Vinculos

| Aluno | Curso | Matricula |
| --- | --- | --- |
| Einstein IB Neves | ADS | `ADS/0020015914` |
| Einstein IB Neves | JD | `JD/0020015915` |
| Hilccer Rocha Araujo Melo | ADS | `ADS/0020015916` |
| Izabel Santos | JD | `JD/0020015917` |

O curso ativo inicial de Einstein e ADS. A troca para JD pode ser demonstrada no PWA e no mobile. Certificados e horas foram gravados com `course_id`, `vinculo_id` e matricula do vinculo correto.

O coordenador de demonstracao esta vinculado a ADS, JD e TDS.

## Regras de horas

Cada curso recebe as categorias:

| Categoria | Limite |
| --- | ---: |
| Cursos livres | 40h |
| Eventos | 30h |
| Projetos | 50h |
| Monitoria | 30h |
| Extensao | 40h |
| Estagio | 40h |
| Representante de turma | 20h |

## Casos controlados

- Einstein em ADS: 50h aprovadas de 120h, com casos aprovado, em analise, rejeitado, removido da contagem e duplicado.
- Einstein em JD: 20h aprovadas de 120h, isoladas do vinculo ADS.
- Hilccer em ADS: 0h de 120h e risco ML alto.
- Izabel em JD: 120h de 120h e risco ML baixo.

O seed tambem cria poucas atividades, oportunidades, regras, registros OCR e uma execucao ML concluida.

## Validacao

Antes de usar:

```powershell
node --check scripts/backup-before-reset.js
node --check scripts/reset-demo-database.js
node --check scripts/seed-senac-demo.js
node --check server.js
npm test
```

Depois do reset e seed, valide login, paineis, troca de curso, isolamento das horas, certificados, atividades, oportunidades, OCR e ML.
