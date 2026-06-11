import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'sponsor_dashboard.dart';

void main() => runApp(const TukaApp());

class TukaApp extends StatelessWidget {
  const TukaApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tuka',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const ChallengeScreen(),
    );
  }
}

class ChallengeScreen extends StatefulWidget {
  const ChallengeScreen({super.key});
  @override
  State<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends State<ChallengeScreen> {
  String _filter = 'around';
  String _city = '';
  List<dynamic> _challenges = [];
  bool _loading = false;
  final String _userId = 'user-123';
  final double _userLat = 0.3150;
  final double _userLng = 32.5800;
  String get _baseUrl => 'http://10.0.2.2:3000';

  Future<void> _fetchChallenges() async {
    setState(() => _loading = true);
    try {
      String url = '$_baseUrl/api/challenges?filter=$_filter';
      if (_filter == 'around') url += '&lat=$_userLat&lng=$_userLng&radius=25';
      if (_filter == 'only' && _city.isNotEmpty) url += '&city=$_city';

      final res = await http.get(Uri.parse(url));
      if (res.statusCode == 200) {
        setState(() => _challenges = json.decode(res.body));
      }
    } catch (e) {
      debugPrint('Error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitProof(String challengeId) async {
    final choice = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit Proof'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Photo'),
              onTap: () => Navigator.pop(context, 'photo'),
            ),
            ListTile(
              leading: const Icon(Icons.videocam),
              title: const Text('Video'),
              onTap: () => Navigator.pop(context, 'video'),
            ),
            ListTile(
              leading: const Icon(Icons.text_fields),
              title: const Text('Text'),
              onTap: () => Navigator.pop(context, 'text'),
            ),
          ],
        ),
      ),
    );

    if (choice == null) return;

    String proofText = '';
    if (choice == 'text') {
      proofText = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Describe completion'),
          content: const TextField(maxLines: 4),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(onPressed: () => Navigator.pop(context, 'Done'), child: const Text('Submit')),
          ],
        ),
      ) ?? '';
    } else {
      proofText = '${choice.toUpperCase()} proof at ${DateTime.now()}';
    }

    if (proofText.isEmpty) return;

    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/submissions'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'challengeId': challengeId,
          'userId': _userId,
          'proofText': proofText,
          'userLat': _userLat,
          'userLng': _userLng,
        }),
      );
      
      if (res.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Submitted! Sponsor will review.'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('❌ Failed'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchChallenges();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('⛏️ Tuka - Earn Now'),
        backgroundColor: const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.dashboard),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SponsorDashboard(sponsorId: 'sponsor-123')),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.blue[50],
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _filter,
                    items: const [
                      DropdownMenuItem(value: 'around', child: Text('📍 Around Me')),
                      DropdownMenuItem(value: 'anywhere', child: Text('🌍 Anywhere')),
                      DropdownMenuItem(value: 'only', child: Text('🏙️ City')),
                    ],
                    onChanged: (v) => setState(() => _filter = v!),
                  ),
                ),
                if (_filter == 'only')
                  SizedBox(
                    width: 100,
                    child: TextField(
                      decoration: const InputDecoration(hintText: 'City'),
                      onChanged: (v) => setState(() => _city = v),
                    ),
                  ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _loading ? null : _fetchChallenges,
                  icon: const Icon(Icons.search),
                  label: const Text('Go'),
                ),
              ],
            ),
          ),
          _loading
              ? const Expanded(child: Center(child: CircularProgressIndicator()))
              : _challenges.isEmpty
                  ? const Expanded(child: Center(child: Text('No challenges')))
                  : Expanded(
                      child: ListView.builder(
                        itemCount: _challenges.length,
                        itemBuilder: (context, i) {
                          final c = _challenges[i];
                          final fee = (c['rewardPool'] * c['feePercent']).round();
                          final toUsers = c['rewardPool'] - fee;

                          return Card(
                            margin: const EdgeInsets.all(8),
                            child: ListTile(
                              leading: Icon(
                                c['locationType'] == 'REMOTE' ? Icons.cloud : Icons.location_on,
                                color: c['locationType'] == 'REMOTE' ? Colors.blue : Colors.red,
                              ),
                              title: Text(c['title']),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${c['sponsor']['name']} • ${c['city']}'),
                                  Text('💰 UGX ${c['rewardPool']} (You get: UGX $toUsers)'),
                                  if (c['distance'] != null) Text('📍 ${c['distance']} km'),
                                ],
                              ),
                              trailing: ElevatedButton(
                                onPressed: () => _submitProof(c['id']),
                                child: const Text('Join'),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ],
      ),
    );
  }
}