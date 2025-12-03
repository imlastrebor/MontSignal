API Bulletin Avalanche (EN)



By TR

2 min

Add a reaction
Jun 12, 2025 updated on Jul 10, 2025 

To learn more about the API product descriptions, please visit the following pages:

the description of the product Real-time Avalanche Risk Estimate Bulletin;

the description of the product Archived Avalanche Risk Estimate Bulletin.

 

Pre-requisite: you must have consulted the Météo-France portal API user guide

Main features of this API
How the API works
Common mistakes
Use case
Main features of this API
Data retention time (depth) = 5 days

Real-time = yes

Archive = no

Access granularity = unit products of avalanche bulletin

Domain = mainland France


Update frequency = daily update at least during the season covered

Synchronous/asynchronous = synchronous

Limitation(s) : only the latest products are available

How the API works
This API gives access to the real-time Avalanche Risk Assessment Bulletin (BRA), for its most recent version.

download the list of massifs covered

download the most recent product ("current") of each file in the Avalanche Risk Assessment Bulletin flow

Common mistakes
error 404 "no matching blob" message when accessing the files: the Avalanche Bulletin product is not available out of the covered season. 

 

Use case
In development mode: I want to display the risk level of the "Haute-Bigorre" Pyrenees massif for days D+1 and D+2, as well as the rose of the slopes and snow coverage.

download the list of massifs with the web service /liste-massifs 
List of massifs download request:



 curl -X 'GET' 'https://public-api.meteofrance.fr/public/DPBRA/v1/liste-massifs' -H 'accept: */*' -H 'Authorization: Bearer <your_oauth2_token_here>"
 

Massifs list:



{
  "type": "FeatureCollection",
  "name": "Metadata_massif_DP_2024",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
  },
  "features": [
...
    {
      "type": "Feature",
      "properties": {
        "code": 66,
        "mountain": "Pyrenees",
        "title": "Haute-Bigorre",
        "title_shor": "H-Big",
        "lon_center": 0.01979,
        "lat_center": 42.89645,
        "Departemen": "Hautes-Pyrenees",
        "Dep2": null
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [
          [
            [
              [
                -0.31343,
                42.8494
              ],
              [
                -0.31145,
                42.85251
              ],
...
              [
                -0.30506,
                42.84132
              ],
              [
                -0.31343,
                42.8494
              ]
            ]
          ]
        ]
      }
    },
...
  ]
}
 

identify the massif whose title="Haute-Bigorre" => id-massif=66

 

download the risk assessments for days D+1 and D+2 of massif id 66 with the web service /massif/BRA at XML format
Avalanche bulletin request:



curl -X 'GET' 'https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=66&format=xml' -H 'accept: */*' -H 'Authorization: Bearer <your_oauth2_token_here>"
Avalanche bulletin on 02/12/2024 at 15:00 UTC:



<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <?xml-stylesheet type="text/xsl" href="../web/bra.xslt"?>
    <BULLETINS_NEIGE_AVALANCHE xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" TYPEBULLETIN="BRA" ID="66" MASSIF="Haute-Bigorre" DATEBULLETIN="2024-12-02T15:00:00" DATEECHEANCE="2024-12-03T18:00:00" DATEVALIDITE="2024-12-03T18:00:00" DATEDIFFUSION="2024-12-02T15:17:00" AMENDEMENT="false">
      <DateValidite>2024-12-03T18:00:00</DateValidite>
      <CARTOUCHERISQUE>
        <RISQUE RISQUE1="1" EVOLURISQUE1="" LOC1="" ALTITUDE="" RISQUE2="" EVOLURISQUE2="" LOC2="" RISQUEMAXI="1" COMMENTAIRE="Indice de risque faible." RISQUEMAXIJ2="2" DATE_RISQUE_J2="2024-12-04T00:00:00"/>
        <PENTE NE="true" E="false" SE="false" S="false" SW="false" W="false" NW="false" N="true" COMMENTAIRE="Rares, en altitude"/>
        <ACCIDENTEL><![CDATA[Fine couche de neige fraîche sur quelques plaques anciennes durcies. ]]></ACCIDENTEL>
        <NATUREL><![CDATA[Faibles coulées possibles.]]></NATUREL>
        <RESUME><![CDATA[Départs spontanés : Faibles coulées possibles.
Déclenchements skieurs : Fine couche de neige fraîche sur quelques plaques anciennes durcies. ]]></RESUME>
        <RisqueJ2><![CDATA[Indice de risque limité]]></RisqueJ2>
        <CommentaireRisqueJ2><![CDATA[Des apports nouveaux avec du vent de nord pouvant créer des plaques sensibles.]]></CommentaireRisqueJ2>
        <AVIS/>
        <VIGILANCE/>
        <ImageRisque>montagne_risques_66.png</ImageRisque>
        <ImagePente>rose_pentes_66.png</ImagePente>
      </CARTOUCHERISQUE>
...
    </BULLETINS_NEIGE_AVALANCHE>
 

identify the risks:


for D+1 day:  

DATEVALIDITE="2024-12-03T18:00:00"
RISQUEMAXI="1"

for D+2 day:

DATE_RISQUE_J2="2024-12-04T00:00:00"

RISQUEMAXIJ2="2"

download the picture files of the Avalanche bulletin: rose of the slopes and snow coverage of massif id 66 at PNG format
Pictures of the bulletin flow download requests:



curl -X 'GET' 'https://public-api.meteofrance.fr/public/DPBRA/v1/massif/image/rose-pentes?id-massif=66' -H 'accept: */*' -H 'Authorization: Bearer <your_oauth2_token_here>"
curl -X 'GET' 'https://public-api.meteofrance.fr/public/DPBRA/v1/massif/image/montagne-enneigement?id-massif=66' -H 'accept: */*' -H 'Authorization: Bearer <your_oauth2_token_here>"
display on his web site the informations : 
