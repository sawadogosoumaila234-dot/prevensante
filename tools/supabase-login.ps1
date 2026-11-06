# Connexion du CLI Supabase, avec diagnostic complet.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\supabase-login.ps1
#
# Le jeton est lu par Read-Host : il n'apparait ni dans la ligne de commande,
# ni dans l'historique du shell. Il est transmis au CLI, qui l'ecrit dans
# ~/.supabase/profile.
#
# A LIRE : ce script affiche des chemins et une liste de projets. Il n'affiche
# JAMAIS le jeton. Vous pouvez donc coller sa sortie integralement.
#
# Le jeton d'acces personnel Supabase est un jeton d'ADMINISTRATION : il peut
# creer et supprimer des projets. Supprimez-le depuis
# https://supabase.com/dashboard/account/tokens une fois la publication faite.
$ErrorActionPreference = 'Continue'

$racine = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $racine 'node_modules\.bin\supabase.cmd'

Write-Host '=== 1. Environnement ==='
Write-Host ("  dossier courant      : " + (Get-Location).Path)
Write-Host ("  HOME                 : " + $HOME)
Write-Host ("  USERPROFILE          : " + $env:USERPROFILE)
$profil = Join-Path $HOME '.supabase\profile'
Write-Host ("  profil attendu       : " + $profil)
Write-Host ("  profil deja present  : " + (Test-Path $profil))
Write-Host ("  binaire du depot     : " + (Test-Path $cli))
$global = Get-Command supabase -ErrorAction SilentlyContinue
Write-Host ("  binaire global       : " + $(if ($global) { $global.Source } else { '(aucun)' }))
Write-Host ''

if (-not (Test-Path $cli)) {
    Write-Error "CLI Supabase introuvable dans le depot. Lancer « npm ci » a la racine, puis recommencer."
    exit 1
}
Set-Location $racine

Write-Host '=== 2. Connexion ==='
$token = Read-Host 'Jeton d''acces Supabase (sbp_...)'
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Error 'Aucun jeton saisi : rien n a ete fait.'
    exit 1
}
if ($token -notmatch '^sbp_[A-Za-z0-9]{20,}$') {
    Write-Warning 'Ce jeton ne ressemble pas a un jeton personnel Supabase (attendu : sbp_ + caracteres).'
    Write-Warning 'La cle API « anon » (eyJ...) ne convient pas.'
}
Write-Host ''
& $cli login --token $token
$code = $LASTEXITCODE
Remove-Variable token
Write-Host ("  code de sortie du login : " + $code)
Write-Host ("  profil apres connexion  : " + (Test-Path $profil))
Write-Host ''

Write-Host '=== 3. Projets accessibles ==='
& $cli projects list
Write-Host ''
Write-Host '=== 4. Verdict ==='
if (Test-Path $profil) {
    Write-Host '  AUTHENTIFICATION REUSSIE : le profil existe.'
} else {
    Write-Host '  ECHEC : aucun profil ecrit. Collez cette sortie complete a votre assistant.'
}
