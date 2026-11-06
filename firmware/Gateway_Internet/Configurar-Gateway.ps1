param([string]$Puerto)
$ErrorActionPreference = 'Stop'
if (!$Puerto) {
    Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Name | Out-Host
    $Puerto = Read-Host 'Puerto del gateway (por ejemplo COM3)'
}
if ($Puerto -notmatch '^COM[0-9]+$') { throw 'Escribe un puerto COM válido.' }

function Wait-GatewayMessage($Port, $Type) {
    $limit = [DateTime]::UtcNow.AddSeconds(15)
    while ([DateTime]::UtcNow -lt $limit) {
        try { $line = $Port.ReadLine().Trim() } catch [TimeoutException] { continue }
        if (!$line.StartsWith('HI:')) { continue }
        try { $message = $line.Substring(3) | ConvertFrom-Json } catch { continue }
        if ($message.type -eq $Type) { return $message }
    }
    throw 'El gateway no respondió. Comprueba el cable y que el navegador haya desconectado el USB.'
}

$port = [IO.Ports.SerialPort]::new($Puerto, 115200)
$port.Encoding = [Text.UTF8Encoding]::new($false)
$port.ReadTimeout = 650
$port.WriteTimeout = 4000
try {
    $port.Open()
    $port.WriteLine('{"cmd":"hello"}')
    $hello = Wait-GatewayMessage $port 'hello'
    if ($hello.protocol -ne 1 -or $hello.hardware -notmatch '^ESP32-[A-F0-9]{12}$') {
        throw 'El firmware del gateway no es compatible.'
    }
    Write-Host ('Identificador del receptor: ' + $hello.hardware)
    $code = Read-Host 'Pega el código que generó la página' -AsSecureString
    $config = [Net.NetworkCredential]::new('', $code).Password | ConvertFrom-Json
    if ($config.hardware -cne $hello.hardware -or $config.token -notmatch '^GW_[a-f0-9]{64}$' -or $config.nonce -notmatch '^[a-f0-9]{32}$' -or !$config.mapping -or $config.mapping.Count -gt 8) {
        throw 'El código es inválido o corresponde a otro gateway.'
    }
    $ssid = Read-Host 'Nombre de la red Wi-Fi de 2.4 GHz'
    $secret = Read-Host 'Contraseña Wi-Fi' -AsSecureString
    $password = [Net.NetworkCredential]::new('', $secret).Password
    if (!$ssid -or [Text.Encoding]::UTF8.GetByteCount($ssid) -gt 32 -or [Text.Encoding]::UTF8.GetByteCount($password) -notin (8..63)) {
        throw 'Revisa el nombre de la red y la contraseña.'
    }
    $command = @{cmd='configure';ssid=$ssid;password=$password;token=$config.token;nonce=$config.nonce;ticket=$config.ticket;url=$config.url;key=$config.key;mapping=$config.mapping}
    $port.WriteLine(($command | ConvertTo-Json -Compress -Depth 8))
    $saved = Wait-GatewayMessage $port 'saved'
    if ($saved.proof -notmatch '^[a-f0-9]{64}$') { throw 'La confirmación del receptor es inválida.' }
    Write-Host ('Pega esta confirmación en la página y pulsa Activar gateway: ' + $saved.proof)
} finally {
    $port.Dispose()
}
